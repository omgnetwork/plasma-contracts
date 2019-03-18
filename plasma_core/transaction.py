import rlp
from rlp.sedes import big_endian_int, binary, CountableList
from rlp.sedes.lists import is_sequence
from typing import Union
from ethereum import utils
from plasma_core.utils.signatures import sign, get_signer
from plasma_core.utils.transactions import encode_utxo_id
from plasma_core.constants import NULL_SIGNATURE, NULL_ADDRESS


def pad_list(to_pad, value, required_length):
    return to_pad + [value] * (required_length - len(to_pad))


class TransactionInput(rlp.Serializable):

    fields = (
        ('blknum', big_endian_int),
        ('txindex', big_endian_int),
        ('oindex', big_endian_int)
    )

    def __init__(self, blknum=0, txindex=0, oindex=0):
        self.blknum = blknum
        self.txindex = txindex
        self.oindex = oindex

    @property
    def identifier(self):
        return encode_utxo_id(self.blknum, self.txindex, self.oindex)


class TransactionOutputBase(object):
    fields = (
        ('owner', utils.address),
        ('token', utils.address)
    )

    def __init__(self, owner=NULL_ADDRESS, token=NULL_ADDRESS):
        self.owner = utils.normalize_address(owner)
        self.token = utils.normalize_address(token)

    def serialize_base(self):
        return [
            utils.address.serialize(self.owner),
            utils.address.serialize(self.token)
        ]

    @classmethod
    def serialize(cls, obj):
        return obj.serialize()

    @classmethod
    def deserialize(cls, serial):
        assert False  # TODO: Implement

    @staticmethod
    def create_output(owner, token, value: Union[int, list]):
        if isinstance(value, int):
            return TransactionOutputFT(owner, token, value)
        elif isinstance(value, list):
            return TransactionOutputNFT(owner, token, value)
        else:
            raise RuntimeError("Unsupported value type for output")


class TransactionOutputFT(TransactionOutputBase):

    def __init__(self, owner=NULL_ADDRESS, token=NULL_ADDRESS, amount=0):
        super(TransactionOutputFT, self).__init__(owner, token)
        self.amount = amount

    def serialize(self):
        result = super(TransactionOutputFT, self).serialize_base()
        result.append(big_endian_int.serialize(self.amount))
        return result

    @classmethod
    def deserialize(cls, serial):
        assert False  # TODO: Implement


class TransactionOutputNFT(TransactionOutputBase):

    def __init__(self, owner=NULL_ADDRESS, token=NULL_ADDRESS, tokenids=[]):
        super(TransactionOutputNFT, self).__init__(owner, token)
        tokenids.sort()
        self.tokenids = list(set(tokenids))

    def serialize(self):
        result = super(TransactionOutputNFT, self).serialize_base()
        result.append(CountableList(big_endian_int).serialize(self.tokenids))
        return result

    @classmethod
    def deserialize(cls, serial):
        assert False  # TODO: Implement


class Transaction(rlp.Serializable):
    NUM_TXOS = 4
    DEFAULT_INPUT = (0, 0, 0)
    DEFAULT_OUTPUT = (NULL_ADDRESS, NULL_ADDRESS, 0)

    fields = (
        ('inputs', CountableList(TransactionInput, NUM_TXOS)),
        ('outputs', CountableList(TransactionOutputBase, NUM_TXOS)),
        ('signatures', CountableList(binary, NUM_TXOS))
    )

    def __init__(self,
                 inputs=[DEFAULT_INPUT] * NUM_TXOS,
                 outputs=[DEFAULT_OUTPUT] * NUM_TXOS,
                 signatures=[NULL_SIGNATURE] * NUM_TXOS):
        padded_inputs = pad_list(inputs, self.DEFAULT_INPUT, self.NUM_TXOS)
        padded_outputs = pad_list(outputs, self.DEFAULT_OUTPUT, self.NUM_TXOS)

        self.inputs = [TransactionInput(*i) for i in padded_inputs]
        self.outputs = [TransactionOutputBase.create_output(*o) for o in padded_outputs]

        self.signatures = signatures[:]
        self.spent = [False] * self.NUM_TXOS

    @property
    def hash(self):
        return utils.sha3(self.encoded)

    @property
    def signers(self):
        return [get_signer(self.hash, sig) if sig != NULL_SIGNATURE else NULL_ADDRESS for sig in self.signatures]

    @property
    def is_deposit(self):
        return all([i.blknum == 0 for i in self.inputs])

    def sign(self, index, key):
        self.signatures[index] = sign(self.hash, key)

    @property
    def encoded(self):
        return rlp.encode(self, UnsignedTransaction)


UnsignedTransaction = Transaction.exclude(['signatures'])
