from plasma_core.plasma.utils.signatures import sign, get_signer
from plasma_core.plasma.constants import NULL_HASH


def test_sign(ethtester):
    signature = sign(NULL_HASH, ethtester.k0)

    assert get_signer(NULL_HASH, signature) == ethtester.a0
