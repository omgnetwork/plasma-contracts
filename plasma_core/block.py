import rlp
from rlp.sedes import CountableList, big_endian_int
from eth_utils import keccak
from plasma_core.utils.merkle.fixed_merkle import FixedMerkle
from plasma_core.transaction import Transaction
from plasma_core.constants import NULL_SIGNATURE


class Block(rlp.Serializable):

    fields = (
        ('transactions', CountableList(Transaction)),
        ('number', big_endian_int),
    )

    def __init__(self, transactions=None, number=0):
        if transactions is None:
            transactions = []
        super().__init__(transactions, number)

    @property
    def hash(self):
        return keccak(self.encoded)

    @property
    def merklized_transaction_set(self):
        encoded_transactions = [tx.encoded for tx in self.transactions]
        return FixedMerkle(16, encoded_transactions)

    @property
    def root(self):
        return self.merklized_transaction_set.root

    @property
    def encoded(self):
        return rlp.encode(self)

    @property
    def is_deposit_block(self):
        return len(self.transactions) == 1 and self.transactions[0].is_deposit

    def sign(self, key):
        return SignedBlock(self, key.sign_msg_hash(self.hash))


class SignedBlock(Block):

    def __init__(self, block, signature=NULL_SIGNATURE):
        super().__init__(block.transactions, block.number)
        self._signature = signature

    @property
    def signature(self):
        return self._signature.to_bytes()

    @property
    def signer(self):
        return self._signature.recover_public_key_from_msg_hash(self.hash).to_checksum_address()
