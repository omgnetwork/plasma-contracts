from plasma_core.constants import NULL_ADDRESS
from plasma_core.transaction import Transaction
from eip712_structs import make_domain
from plasma_core.utils.eip712_struct_hash import hash_struct


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
    assert hash_struct(empty_tx, test_domain).hex() == 'c67dd6528c3f576a02369244960a19c9e09c4706938630a50e2eaf385d3a291b'


def test_sample_transaction():
    tx = Transaction(inputs=inputs, outputs=outputs)
    assert hash_struct(tx, test_domain).hex() == '6ec5be1d778c6e5d56512b59e68c879cfd2efe27856081c19138ab8dd05d2a41'


def test_transaction_with_metadata():
    tx = Transaction(inputs=inputs, outputs=outputs, metadata=metadata)
    assert hash_struct(tx, test_domain).hex() == '24858ef969d1713414f4776626bcb8b6f5ce6aa4eab6dd4733172a14f547b153'
