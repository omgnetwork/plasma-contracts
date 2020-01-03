import pytest

from plasma_core.constants import NULL_ADDRESS
from plasma_core.transaction import Transaction
from eip712_structs import make_domain
from plasma_core.utils.eip712_struct_hash import hash_struct


verifyingContract = bytes.fromhex('44de0ec539b8c4a4b530c78620fe8320167f2f74')
test_domain = make_domain(
    name='OMG Network',
    version='1',
    verifyingContract=verifyingContract,
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


@pytest.fixture
def hash_lib_wrapper(get_contract):
    return get_contract("PaymentEip712LibMock")


def test_empty_transaction(hash_lib_wrapper):
    empty_tx = Transaction(inputs=[], outputs=[])
    assert hash_struct(empty_tx, test_domain) == hash_lib_wrapper.hashTx(verifyingContract, empty_tx.encoded)


def test_sample_transaction(hash_lib_wrapper):
    tx = Transaction(inputs=inputs, outputs=outputs)
    assert hash_struct(tx, test_domain) == hash_lib_wrapper.hashTx(verifyingContract, tx.encoded)


def test_transaction_with_metadata(hash_lib_wrapper):
    tx = Transaction(inputs=inputs, outputs=outputs, metadata=metadata)
    assert hash_struct(tx, test_domain) == hash_lib_wrapper.hashTx(verifyingContract, tx.encoded)
