import pytest

from plasma_core.constants import NULL_ADDRESS
from plasma_core.transaction import Transaction
from eip712_structs import make_domain
from plasma_core.utils.eip712_struct_hash import hash_struct

# TODO: Run the tests on new tx format
#  Metamask currently does not implement dynamic arrays
pytestmark = pytest.mark.skip(reason="Dynamic arrays and optional fields in tx format")

test_domain = make_domain(
    name='OMG Network',
    version='1',
    verifyingContract=bytes.fromhex('44de0ec539b8c4a4b530c78620fe8320167f2f74'),
    salt=bytes.fromhex('fad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83')
)
owner = bytes.fromhex('2258a5279850f6fb78888a7e45ea2a5eb1b3c436')
token = bytes.fromhex('0123456789abcdef000000000000000000000000')

metadata = bytes.fromhex('853a8d8af99c93405a791b97d57e819e538b06ffaa32ad70da2582500bc18d43')

inputs = [
    (1, 0, 0),
    (1000, 2, 3),
    (101000, 1337, 3)
]
outputs = [
    (owner, NULL_ADDRESS, 100),
    (token, NULL_ADDRESS, 111),
    (owner, token, 1337)
]


# NOTE: following test vectors were confirmed against contracts code
def test_empty_transaction():
    empty_tx = Transaction(inputs=[], outputs=[])
    assert hash_struct(empty_tx, test_domain).hex() == '992ac0f45bff7d9fb74636623e5d8b111b49b818cadcf3a91c035735a84d154f'


def test_sample_transaction():
    tx = Transaction(inputs=inputs, outputs=outputs)
    assert hash_struct(tx, test_domain).hex() == 'b42dc40570279af9faa05e64d62f54db0fd2b768a4a69646efba068cf88eb7a2'


def test_transaction_with_metadata():
    tx = Transaction(inputs=inputs, outputs=outputs, metadata=metadata)
    assert hash_struct(tx, test_domain).hex() == '5f9adeaaba8d2fa17de40f45eb12136c7e7f26ea56567226274314d0a563e81d'
