import rlp
from rlp.sedes import binary, CountableList
from ethereum import utils
from plasma_core.plasma.utils.signatures import sign, get_signer
from plasma_core.plasma.utils.merkle.fixed_merkle import FixedMerkle
from plasma_core.plasma.transaction import Transaction
from plasma_core.plasma.constants import NULL_SIGNATURE


class Block(rlp.Serializable):

    fields = (
        ('transactions', CountableList(Transaction)),
        ('signature', binary)
    )

    def __init__(self, transactions=[], signature=NULL_SIGNATURE):
        self.transactions = transactions
        self.signature = signature

    @property
    def hash(self):
        return utils.sha3(self.encoded)

    @property
    def signer(self):
        return get_signer(self.hash, self.signature)

    @property
    def merklized_transaction_set(self):
        encoded_transactions = [tx.encoded for tx in self.transactions]
        return FixedMerkle(16, encoded_transactions)

    @property
    def root(self):
        return self.merklized_transaction_set.root

    @property
    def encoded(self):
        return rlp.encode(self, UnsignedBlock)

    def sign(self, key):
        self.signature = sign(self.hash, key)


class UnsignedBlock(rlp.Serializable):

    fields = Block.fields[:-1]
