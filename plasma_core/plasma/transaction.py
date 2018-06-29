import rlp
from rlp.sedes import big_endian_int, binary, CountableList
from ethereum import utils
from plasma_core.plasma.utils.signatures import sign, get_signer
from plasma_core.plasma.utils.transactions import encode_output_id
from plasma_core.plasma.constants import NULL_SIGNATURE, NULL_ADDRESS


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
        return encode_output_id(self.blknum, self.txindex, self.oindex)


class TransactionOutput(rlp.Serializable):

    fields = (
        ('owner', utils.address),
        ('amount', big_endian_int)
    )

    def __init__(self, owner=NULL_ADDRESS, amount=0):
        self.owner = utils.normalize_address(owner)
        self.amount = amount


class Transaction(rlp.Serializable):

    DEFAULT_INPUT = (0, 0, 0)
    DEFAULT_OUTPUT = (NULL_ADDRESS, 0)
    fields = (
        ('inputs', CountableList(TransactionInput)),
        ('outputs', CountableList(TransactionOutput)),
        ('signatures', CountableList(binary))
    )

    def __init__(self,
                 inputs=[],
                 outputs=[],
                 signatures=[],
                 num_txos=4):
        inputs = inputs or [self.DEFAULT_INPUT] * num_txos
        outputs = outputs or [self.DEFAULT_OUTPUT] * num_txos
        signatures = signatures or [NULL_SIGNATURE] * num_txos
        spent = [False] * num_txos

        padded_inputs = pad_list(inputs, self.DEFAULT_INPUT, num_txos)
        padded_outputs = pad_list(outputs, self.DEFAULT_OUTPUT, num_txos)

        self.inputs = [TransactionInput(*i) for i in padded_inputs]
        self.outputs = [TransactionOutput(*o) for o in padded_outputs]
        self.signatures = signatures[:]
        self.spent = spent[:]

    @property
    def hash(self):
        return utils.sha3(self.encoded)

    @property
    def signers(self):
        return [get_signer(self.hash, sig) if sig != NULL_SIGNATURE else NULL_ADDRESS for sig in self.signatures]

    @property
    def encoded(self):
        return rlp.encode(self, UnsignedTransaction)

    def sign(self, index, key):
        self.signatures[index] = sign(self.hash, key)


class UnsignedTransaction(rlp.Serializable):

    fields = Transaction.fields[:-1]
