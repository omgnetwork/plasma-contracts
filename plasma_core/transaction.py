import rlp
from rlp.sedes import big_endian_int, binary
from rlp.sedes.serializable import Serializable
from ethereum import utils
from plasma_core.constants import NULL_SIGNATURE
from plasma_core.utils.signatures import sign, get_signer


class _UnsignedTransaction(Serializable):

    fields = [
        ('blknum1', big_endian_int),
        ('txindex1', big_endian_int),
        ('oindex1', big_endian_int),
        ('blknum2', big_endian_int),
        ('txindex2', big_endian_int),
        ('oindex2', big_endian_int),
        ('cur12', utils.address),
        ('newowner1', utils.address),
        ('amount1', big_endian_int),
        ('newowner2', utils.address),
        ('amount2', big_endian_int),
    ]
    spent1 = False
    spent2 = False


class _SignedTransaction(Serializable):

    fields = [
        ('blknum1', big_endian_int),
        ('txindex1', big_endian_int),
        ('oindex1', big_endian_int),
        ('blknum2', big_endian_int),
        ('txindex2', big_endian_int),
        ('oindex2', big_endian_int),
        ('cur12', utils.address),
        ('newowner1', utils.address),
        ('amount1', big_endian_int),
        ('newowner2', utils.address),
        ('amount2', big_endian_int),
        ('sig1', binary),
        ('sig2', binary),
    ]


class Transaction():

    def __init__(self,
                 blknum1, txindex1, oindex1,
                 blknum2, txindex2, oindex2,
                 cur12,
                 newowner1, amount1,
                 newowner2, amount2,
                 sig1=NULL_SIGNATURE,
                 sig2=NULL_SIGNATURE):
        # Input 1
        self.blknum1 = blknum1
        self.txindex1 = txindex1
        self.oindex1 = oindex1
        self.sig1 = sig1

        # Input 2
        self.blknum2 = blknum2
        self.txindex2 = txindex2
        self.oindex2 = oindex2
        self.sig2 = sig2

        # Token addresses
        self.cur12 = utils.normalize_address(cur12)

        # Outputs
        self.newowner1 = utils.normalize_address(newowner1)
        self.amount1 = amount1

        self.newowner2 = utils.normalize_address(newowner2)
        self.amount2 = amount2

        self.confirmation1 = None
        self.confirmation2 = None

        self.spent1 = False
        self.spent2 = False

    @property
    def hash(self):
        return utils.sha3(self.encoded)

    @property
    def merkle_hash(self):
        return utils.sha3(self.hash + self.sig1 + self.sig2)

    @property
    def is_single_utxo(self):
        return self.blknum2 == 0

    @property
    def is_deposit(self):
        return self.blknum1 == 0 and self.blknum2 == 0

    @property
    def sender1(self):
        return get_signer(self.hash, self.sig1)

    @property
    def sender2(self):
        return get_signer(self.hash, self.sig2)

    @property
    def encoded(self):
        unsigned = _UnsignedTransaction(self.blknum1, self.txindex1, self.oindex1, self.blknum2, self.txindex2, self.oindex2, self.cur12, self.newowner1, self.amount1, self.newowner2, self.amount2)
        return rlp.encode(_UnsignedTransaction.serialize(unsigned))

    def sign1(self, key):
        self.sig1 = sign(self.hash, key)

    def sign2(self, key):
        self.sig2 = sign(self.hash, key)

    def confirm(self, root, key):
        return sign(utils.sha3(self.hash + root), key)

    def serialize(self):
        signed = _SignedTransaction(self.blknum1, self.txindex1, self.oindex1, self.blknum2, self.txindex2, self.oindex2, self.cur12, self.newowner1, self.amount1, self.newowner2, self.amount2, self.sig1, self.sig2)
        return _SignedTransaction.serialize(signed)
