import rlp
from rlp.sedes import big_endian_int, binary, CountableList
from eth_utils import address, keccak
from plasma_core.constants import NULL_SIGNATURE, NULL_ADDRESS, EMPTY_METADATA
from plasma_core.utils.eip712_struct_hash import hash_struct
from plasma_core.utils.transactions import encode_utxo_id
from rlp.exceptions import DeserializationError


def pad_list(to_pad, value, required_length):
    return to_pad + [value] * (required_length - len(to_pad))


class TransactionInput(rlp.Serializable):
    fields = (
        ('blknum', big_endian_int),
        ('txindex', big_endian_int),
        ('oindex', big_endian_int)
    )

    def __init__(self, blknum=0, txindex=0, oindex=0):
        super().__init__(blknum, txindex, oindex)

    @property
    def identifier(self):
        return encode_utxo_id(self.blknum, self.txindex, self.oindex)


class TransactionOutput(rlp.Serializable):
    fields = (
        ('owner', rlp.sedes.Binary.fixed_length(20)),
        ('token', rlp.sedes.Binary.fixed_length(20)),
        ('amount', big_endian_int)
    )

    def __init__(self, owner=NULL_ADDRESS, token=NULL_ADDRESS, amount=0):
        owner = address.to_canonical_address(owner)
        token = address.to_canonical_address(token)
        amount = amount
        super().__init__(owner, token, amount)


class Transaction(rlp.Serializable):
    NUM_TXOS = 4
    DEFAULT_INPUT = (0, 0, 0)
    DEFAULT_OUTPUT = (NULL_ADDRESS, NULL_ADDRESS, 0)
    fields = (
        ('inputs', CountableList(TransactionInput, NUM_TXOS)),
        ('outputs', CountableList(TransactionOutput, NUM_TXOS)),
        ('metadata', binary)
    )

    def __init__(self,
                 inputs=None,
                 outputs=None,
                 metadata=None,
                 signatures=None,
                 signers=None):
        """

        :type signatures: object
        """
        if signatures is None:
            signatures = [NULL_SIGNATURE] * Transaction.NUM_TXOS
        if signers is None:
            signers = [NULL_ADDRESS] * Transaction.NUM_TXOS
        if inputs is None:
            inputs = [Transaction.DEFAULT_INPUT] * Transaction.NUM_TXOS
        if outputs is None:
            outputs = [Transaction.DEFAULT_OUTPUT] * Transaction.NUM_TXOS
        if metadata is None:
            metadata = EMPTY_METADATA

        assert all(len(o) == 3 for o in outputs)
        padded_inputs = pad_list(inputs, self.DEFAULT_INPUT, self.NUM_TXOS)
        padded_outputs = pad_list(outputs, self.DEFAULT_OUTPUT, self.NUM_TXOS)
        inputs = [TransactionInput(*i) for i in padded_inputs]
        outputs = [TransactionOutput(*o) for o in padded_outputs]

        super().__init__(inputs, outputs, metadata)

        self.signatures = signatures[:]
        self._signers = signers[:]
        self.spent = [False] * self.NUM_TXOS

    @property
    def hash(self):
        return keccak(self.encoded)

    @property
    def signers(self):
        return self._signers

    @property
    def encoded(self):
        return rlp.encode(self)

    @property
    def is_deposit(self):
        return all([i.blknum == 0 for i in self.inputs])

    def sign(self, index, account, verifyingContract=None):
        msg_hash = hash_struct(self, verifyingContract=verifyingContract)
        sig = account.key.sign_msg_hash(msg_hash)
        self.signatures[index] = sig.to_bytes()
        self._signers[index] = sig.recover_public_key_from_msg_hash(msg_hash).to_canonical_address() if sig != NULL_SIGNATURE else NULL_ADDRESS

    @staticmethod
    def deserialize(obj):
        raise DeserializationError("not yet implemented", obj)
