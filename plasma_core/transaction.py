import enum

import rlp
from eth_utils import address, keccak
from rlp.sedes import big_endian_int, binary, CountableList, Binary

from plasma_core.constants import NULL_SIGNATURE, NULL_ADDRESS
from plasma_core.utils.eip712_struct_hash import hash_struct
from plasma_core.utils.transactions import encode_utxo_id


class TxTypes(enum.Enum):
    PAYMENT = 1


class TransactionInput:
    def __init__(self, blknum=0, txindex=0, oindex=0):
        self.blknum = blknum
        self.txindex = txindex
        self.oindex = oindex

    @property
    def utxo_id(self):
        return self.identifier.to_bytes(32, 'big')

    @property
    def identifier(self):
        return encode_utxo_id(self.blknum, self.txindex, self.oindex)


class TransactionOutput(rlp.Serializable):
    fields = (
        ('output_guard', rlp.sedes.Binary.fixed_length(20)),
        ('token', rlp.sedes.Binary.fixed_length(20)),
        ('amount', big_endian_int)
    )

    def __init__(self, output_guard=NULL_ADDRESS, token=NULL_ADDRESS, amount=0):
        output_guard = address.to_canonical_address(output_guard)
        token = address.to_canonical_address(token)
        amount = amount
        super().__init__(output_guard, token, amount)


class Transaction(rlp.Serializable):
    NUM_TXOS = 4
    fields = (
        ('tx_type', big_endian_int),
        ('inputs', CountableList(Binary.fixed_length(32), NUM_TXOS)),
        ('outputs', CountableList(TransactionOutput, NUM_TXOS)),
        ('metadata', binary)
    )

    def __init__(self,
                 tx_type=TxTypes.PAYMENT,
                 inputs=None,
                 outputs=None,
                 metadata=None,
                 signatures=None,
                 signers=None):
        """

        :type signatures: object
        """
        if inputs is None:
            inputs = []
        if outputs is None:
            outputs = []
        if signatures is None:
            signatures = [NULL_SIGNATURE] * len(inputs)
        if signers is None:
            signers = [NULL_ADDRESS] * len(inputs)

        inputs = [TransactionInput(*i) for i in inputs]
        outputs = [TransactionOutput(*o) for o in outputs]

        super().__init__(tx_type.value, inputs, outputs, metadata)

        self.signatures = signatures[:]
        self._signers = signers[:]
        self.spent = [False] * len(outputs)

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

    @classmethod
    def serialize(cls, obj):
        sedes_list = [field_sedes for field, field_sedes in cls._meta.fields]

        tx_elems = [
            obj.tx_type,
            [i.utxo_id for i in obj.inputs],
            obj.outputs,
            obj.metadata
        ]
        if not obj.metadata:
            sedes_list.pop(-1)
            tx_elems.pop(-1)

        tx_sedes = rlp.sedes.List(sedes_list)
        return tx_sedes.serialize(tx_elems)

    def sign(self, index, account, verifyingContract=None):
        msg_hash = hash_struct(self, verifyingContract=verifyingContract)
        sig = account.key.sign_msg_hash(msg_hash)
        self.signatures[index] = sig.to_bytes()
        self._signers[index] = sig.recover_public_key_from_msg_hash(
            msg_hash).to_canonical_address() if sig != NULL_SIGNATURE else NULL_ADDRESS
