import pytest
from plasma_core.plasma import Block
from plasma_core.plasma.utils.signatures import sign, get_signer


@pytest.fixture
def block():
    return Block()


def test_signature(ethtester, block):
    block.sign(ethtester.k0)
    signature = sign(block.hash, ethtester.k0)

    assert block.signature == signature
    assert block.signer == get_signer(block.hash, signature)
