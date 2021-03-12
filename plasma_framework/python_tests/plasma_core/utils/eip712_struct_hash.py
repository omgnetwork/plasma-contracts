from eip712_structs import EIP712Struct, Address, Uint, Bytes, Array
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.utils import hex_to_binary
from py_eth_sig_utils.eip712 import encode_typed_data

domainSpec = [
    {'name': 'name', 'type': 'string'},
    {'name': 'version', 'type': 'string'},
    {'name': 'verifyingContract', 'type': 'address'},
    {'name': 'salt', 'type': 'bytes32'},
]
txSpec = [
    {'name': 'txType', 'type': 'uint256'},
    {'name': 'inputs', 'type': 'Input[]'},
    {'name': 'outputs', 'type': 'Output[]'},
    {'name': 'txData', 'type': 'uint256'},
    {'name': 'metadata', 'type': 'bytes32'},
]

inputSpec = [
    {'name': 'blknum', 'type': 'uint256'},
    {'name': 'txindex', 'type': 'uint256'},
    {'name': 'oindex', 'type': 'uint256'},
]

outputSpec = [
    {'name': 'outputType', 'type': 'uint256'},
    {'name': 'outputGuard', 'type': 'bytes20'},
    {'name': 'currency', 'type': 'address'},
    {'name': 'amount', 'type': 'uint256'},
]

data = {
    'types': {
        'EIP712Domain': domainSpec,
        'Transaction': txSpec,
        'Input': inputSpec,
        'Output': outputSpec,
    },
    'domain': {
        'name': 'OMG Network',
        'version': '2',
        'verifyingContract': '0x44de0ec539b8c4a4b530c78620fe8320167f2f74',
        'salt': bytes.fromhex('fad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83'),
    },
    'primaryType': 'Transaction',
}


EMPTY_BYTES20 = '0x0000000000000000000000000000000000000000'

def hash_struct(tx, verifying_contract=None):
    verifying_address = hex_to_binary(verifying_contract) if verifying_contract else NULL_ADDRESS

    data.get('domain')['verifyingContract'] = verifying_address
    data['message'] = struct_tx_from_tx(tx)

    typedData = encode_typed_data(data)
    return typedData


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
    # inputs = Array(Bytes(), 32)
    # outputs = Array(Bytes(), 32)
    inputs = Array(Input)
    outputs = Array(Output)
    txData = Uint(256)
    metadata = Bytes(32)


def struct_tx_from_tx(tx):
    inputs = _map_inputs(tx.inputs)
    outputs = _map_outputs(tx.outputs)

    # for input in inputs:
    #   print(input)

    # for output in outputs:
    #   print(output)

    return Transaction(
        txType=tx.tx_type,
        inputs=inputs,
        outputs=outputs,
        txData=tx.tx_data,
        metadata=tx.metadata,
    )


def _map_inputs(inputs):
    eip712_inputs = [Input(blknum=i.blknum, txindex=i.txindex, oindex=i.oindex) for i in inputs]
    return eip712_inputs


def _map_outputs(outputs):
    eip712_outputs = []
    for o in outputs:
        eip712_outputs.append(Output(outputType=o.output_type, outputGuard=o.output_guard, currency=o.token, amount=o.amount))
    return eip712_outputs
