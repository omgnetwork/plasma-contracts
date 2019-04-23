from plasma_core.constants import NULL_ADDRESS
from plasma_core.transaction import Transaction
from eip712_structs import make_domain
from plasma_core.utils.eip712_struct_hash import hash_struct


test_domain = make_domain(
    name='OMG Network',
    version='1',
    chainId=4,
    verifyingContract=bytes.fromhex('1C56346CD2A2Bf3202F771f50d3D14a367B48070'),
    salt=bytes.fromhex('f2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a558')
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
    assert hash_struct(empty_tx, test_domain).hex() == '0aa26a80d09f12d1f03b8bd0dcfd66fb5776554b326a56d21cfdfdc25254a9c4'


def test_sample_transaction():
    tx = Transaction(inputs=inputs, outputs=outputs)
    assert hash_struct(tx, test_domain).hex() == '71e72678fe793358b35855734a9987d4d377bb1f9b5d4b04b8f2554a34e51628'


def test_transaction_with_metadata():
    tx = Transaction(inputs=inputs, outputs=outputs, metadata=metadata)
    assert hash_struct(tx, test_domain).hex() == '78ddf5f81d7e9271bc125ae6590a8aa27a630135c4f0ba094cd7fd7943a8a2f4'
