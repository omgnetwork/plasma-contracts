from eip712_structs import EIP712Struct, Address, Uint, Bytes, make_domain
from plasma_core.constants import NULL_ADDRESS
from eth_utils import keccak
from plasma_core.utils.utils import hex_to_binary


def hash_struct(tx, domain=None, verifying_contract=None):
    if domain and verifying_contract:
        raise RuntimeError("verifyingContract supplied but ignored")

    verifying_address = hex_to_binary(verifying_contract.address) if verifying_contract else NULL_ADDRESS

    domain = domain or make_domain(
        name='OMG Network',
        version='1',
        verifyingContract=verifying_address,
        salt=hex_to_binary('fad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83')
    )

    return keccak(b'\x19\x01' + domain.hash_struct() + struct_tx_from_tx(tx).hash_struct())


class Input(EIP712Struct):
    blknum = Uint(256)
    txindex = Uint(256)
    oindex = Uint(256)


class Output(EIP712Struct):
    outputType = Uint(256)
    outputGuard = Bytes(20)
    currency = Address()
    amount = Uint(256)


class Transaction(EIP712Struct):
    txType = Uint(256)
    input0 = Input
    input1 = Input
    input2 = Input
    input3 = Input
    output0 = Output
    output1 = Output
    output2 = Output
    output3 = Output
    metadata = Bytes(32)


def struct_tx_from_tx(tx):
    inputs = _map_inputs(tx.inputs)
    outputs = _map_outputs(tx.outputs)

    return Transaction(
        txType=tx.tx_type,
        input0=inputs[0],
        input1=inputs[1],
        input2=inputs[2],
        input3=inputs[3],
        output0=outputs[0],
        output1=outputs[1],
        output2=outputs[2],
        output3=outputs[3],
        metadata=tx.metadata,
    )


def _map_inputs(inputs):
    empty_input = Input()

    eip712_inputs = [Input(blknum=i.blknum, txindex=i.txindex, oindex=i.oindex) for i in inputs]
    return eip712_inputs + [empty_input] * (4 - len(inputs))  # pad with empty inputs


def _map_outputs(outputs):
    empty_output = Output()

    eip712_outputs = []
    for o in outputs:
        eip712_outputs.append(Output(outputType=o.output_type, outputGuard=o.output_guard, currency=o.token, amount=o.amount))
    return eip712_outputs + [empty_output] * (4 - len(outputs))  # pad with empty outputs
