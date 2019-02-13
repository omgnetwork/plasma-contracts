import rlp
from rlp.sedes import big_endian_int, binary, CountableList
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


class TransactionOutput(rlp.Serializable):

    fields = (
        ('owner', utils.address),
        ('token', utils.address),
        ('amount', big_endian_int)
    )

    def __init__(self, owner=NULL_ADDRESS, token=NULL_ADDRESS, amount=0):
        self.owner = utils.normalize_address(owner)
        self.token = utils.normalize_address(token)
        self.amount = amount


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
                 inputs=[DEFAULT_INPUT] * NUM_TXOS,
                 outputs=[DEFAULT_OUTPUT] * NUM_TXOS,
                 metadata="",
                 signatures=[NULL_SIGNATURE] * NUM_TXOS):
        padded_inputs = pad_list(inputs, self.DEFAULT_INPUT, self.NUM_TXOS)
        padded_outputs = pad_list(outputs, self.DEFAULT_OUTPUT, self.NUM_TXOS)

        self.inputs = [TransactionInput(*i) for i in padded_inputs]
        self.outputs = [TransactionOutput(*o) for o in padded_outputs]
        self.metadata = metadata
        self.signatures = signatures[:]
        self.spent = [False] * self.NUM_TXOS

    @property
    def hash(self):
        return utils.sha3(self.encoded)

    @property
    def signers(self):
        return [get_signer(self.hash, sig) if sig != NULL_SIGNATURE else NULL_ADDRESS for sig in self.signatures]

    @property
    def encoded(self):
        return rlp.encode(self)

    @property
    def is_deposit(self):
        return all([i.blknum == 0 for i in self.inputs])

    def sign(self, index, key):
        self.signatures[index] = sign(self.hash, key)
