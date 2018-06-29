import json
import os
from solc import compile_standard


OUTPUT_DIR = 'contract_data'


def get_solc_input(contracts_dir):
    """Walks the contract directory and returns a Solidity input dict

    Learn more about Solidity input JSON here: https://goo.gl/7zKBvj

    Returns:
        dict: A Solidity input JSON object as a dict
    """

    solc_input = {
        'language': 'Solidity',
        'sources': {
            file_name: {
                'urls': [os.path.realpath(os.path.join(r, file_name))]
            } for r, d, f in os.walk(contracts_dir) for file_name in f
        },
        'settings': {
            'outputSelection': {
                "*": {
                    "": [
                        "legacyAST",
                        "ast"
                    ],
                    "*": [
                        "abi",
                        "evm.bytecode.object",
                        "evm.bytecode.sourceMap",
                        "evm.deployedBytecode.object",
                        "evm.deployedBytecode.sourceMap"
                    ]
                }
            }
        }
    }

    return solc_input


def compile_all(contracts_dir):
    """Compiles all of the contracts in the /contracts directory

    Creates {contract name}.json files in /build that contain
    the build output for each contract.
    """

    # Solidity input JSON
    solc_input = get_solc_input(contracts_dir)

    # Compile the contracts
    compilation_result = compile_standard(solc_input, allow_paths=contracts_dir)

    # Create the output folder if it doesn't already exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Write the contract ABI to output files
    compiled_contracts = compilation_result['contracts']
    for contract_file in compiled_contracts:
        for contract in compiled_contracts[contract_file]:
            contract_name = contract.split('.')[0]
            contract_data = compiled_contracts[contract_file][contract_name]

            contract_data_path = OUTPUT_DIR + '/{0}.json'.format(contract_name)
            with open(contract_data_path, "w+") as contract_data_file:
                json.dump(contract_data, contract_data_file)


def get_contract_data(contract_name):
    """Returns the contract data for a given contract

    Args:
        contract_name (str): Name of the contract to return.

    Returns:
        str, str: ABI and bytecode of the contract
    """

    contract_data_path = OUTPUT_DIR + '/{0}.json'.format(contract_name)
    with open(contract_data_path, 'r') as contract_data_file:
        contract_data = json.load(contract_data_file)

    abi = contract_data['abi']
    bytecode = contract_data['evm']['bytecode']['object']

    return abi, bytecode
