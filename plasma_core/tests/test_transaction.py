import pytest
from plasma_core.plasma import Transaction
from plasma_core.plasma.utils.signatures import sign, get_signer


@pytest.fixture
def transaction():
    return Transaction()


@pytest.mark.parametrize("signature_index", [0, 1, 2, 3])
def test_signature(ethtester, transaction, signature_index):
    transaction.sign(signature_index, ethtester.k0)
    signature = sign(transaction.hash, ethtester.k0)
    signer = get_signer(transaction.hash, signature)

    assert transaction.signatures[signature_index] == signature
    assert transaction.signers[signature_index] == signer
