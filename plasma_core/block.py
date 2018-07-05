import rlp
from rlp.sedes import binary, CountableList, big_endian_int
from ethereum import utils
from plasma_core.constants import NULL_SIGNATURE
from plasma_core.transaction import Transaction
from plasma_core.utils.merkle.fixed_merkle import FixedMerkle
from plasma_core.utils.signatures import sign, get_signer


class Block(rlp.Serializable):

    fields = [
        ('transaction_set', CountableList(Transaction)),
        ('sig', binary),
        ('number', big_endian_int)
    ]

    def __init__(self, transaction_set=[], sig=NULL_SIGNATURE, number=0):
        self.transaction_set = transaction_set
        self.sig = sig
        self.number = number

    @property
    def hash(self):
        return utils.sha3(self.encoded)

    @property
    def signer(self):
        return get_signer(self.hash, self.sig)

    @property
    def root(self):
        return self.merkle_tree.root

    @property
    def merkle_tree(self):
        hashed_transaction_set = [transaction.merkle_hash for transaction in self.transaction_set]
        return FixedMerkle(16, hashed_transaction_set, hashed=True)

    @property
    def encoded(self):
        return rlp.encode(self, UnsignedBlock)

    @property
    def is_deposit_block(self):
        return len(self.transaction_set) == 1 and self.transaction_set[0].is_deposit

    def sign(self, key):
        self.sig = sign(self.hash, key)


UnsignedBlock = Block.exclude(['sig'])
