from eip712_structs import EIP712Struct, Address, Uint, Bytes, make_domain
from eth_utils.crypto import keccak
from plasma_core.constants import NULL_HASH, NULL_ADDRESS


def hash_struct(tx, domain=None, verifyingContract=None):
    if domain and verifyingContract:
        raise RuntimeError("verifyingContract supplied but ignored")

    verifying_address = verifyingContract.address if verifyingContract else NULL_ADDRESS

    inputs = [Input(blknum=i.blknum, txindex=i.txindex, oindex=i.oindex) for i in tx.inputs]
    outputs = [Output(owner=o.output_guard, currency=o.token, amount=o.amount) for o in tx.outputs]

    domain = domain or make_domain(
        name='OMG Network',
        version='1',
        verifyingContract=verifying_address,
        salt=bytes.fromhex('fad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83')
    )

    type = Transaction().encode_type() + Input.encode_type() + Output.encode_type()
    values = [_hash_typed(t) for t in inputs] + [_hash_typed(t) for t in outputs] + [tx.metadata or NULL_HASH]

    return keccak(b'\x19\x01' + _hash_typed(domain) + _hash_struct(type, b''.join(values)))


def _hash_struct(type, value):
    return keccak(keccak(text=type) + value)


def _hash_typed(obj):
    return _hash_struct(obj.encode_type(), obj.encode_value())


# NOTE: eip712_structs computes hashes incorrectly however we could fix implementation based on it's building blocks
class Input(EIP712Struct):
    blknum = Uint(256)
    txindex = Uint(256)
    oindex = Uint(256)


class Output(EIP712Struct):
    output_guard = Bytes(32)
    currency = Address()
    amount = Uint(256)


class Transaction(EIP712Struct):
    input0 = Input()
    input1 = Input()
    input2 = Input()
    input3 = Input()
    output0 = Output()
    output1 = Output()
    output2 = Output()
    output3 = Output()
    metadata = Bytes(32)
