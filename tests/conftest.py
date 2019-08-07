import os

import pytest
from eth_tester import EthereumTester, PyEVMBackend
from solc_simple import Builder
from solcx import link_code
from web3 import Web3, EthereumTesterProvider

from plasma_core.account import EthereumAccount
from plasma_core.utils.deployer import Deployer
from testlang.testlang import TestingLanguage
from tests.contract_wrapper import ConvenienceContractWrapper

EXIT_PERIOD = 4 * 60  # 4 minutes

GAS_LIMIT = 10000000
START_GAS = GAS_LIMIT - 1000000


@pytest.fixture(scope="session")
def deployer():
    own_dir = os.path.dirname(os.path.realpath(__file__))
    contracts_dir = os.path.abspath(os.path.realpath(os.path.join(own_dir, '../contracts')))
    output_dir = os.path.abspath(os.path.realpath(os.path.join(own_dir, '../build')))

    builder = Builder(contracts_dir, output_dir)
    builder.compile_all()
    deployer = Deployer(builder)
    return deployer


@pytest.fixture
def backend():
    from eth_tester.backends.pyevm.main import get_default_genesis_params
    genesis_params = get_default_genesis_params(overrides={'gas_limit': GAS_LIMIT})
    return PyEVMBackend(genesis_params)


@pytest.fixture
def tester(backend):
    return EthereumTester(backend)


@pytest.fixture
def accounts(backend):
    return [EthereumAccount(pk.public_key.to_checksum_address(), pk) for pk in backend.account_keys]


@pytest.fixture
def w3(tester, accounts) -> Web3:
    w3 = Web3(EthereumTesterProvider(tester))
    w3.eth.defaultAccount = accounts[0].address
    return w3


# def pytest_addoption(parser):
#     parser.addoption("--runslow", action="store_true",
#                      default=False, help="run slow tests")
#
#
# def pytest_collection_modifyitems(config, items):
#     if config.getoption("--runslow"):
#         # --runslow given in cli: do not skip slow tests
#         return
#     skip_slow = pytest.mark.skip(reason="need --runslow option to run")
#     for item in items:
#         if "slow" in item.keywords:
#             item.add_marker(skip_slow)
#


@pytest.fixture
def get_contract(w3, deployer, accounts):
    def create_contract(path, args=(), sender=accounts[0], libraries=None):
        if libraries is None:
            libraries = dict()
        abi, hexcode = deployer.builder.get_contract_data(path)

        libraries = _encode_libs(libraries)
        linked_hexcode = link_code(hexcode, libraries)
        Contract = w3.eth.contract(abi=abi, bytecode=linked_hexcode)
        tx_hash = Contract.constructor(*args).transact({'gas': START_GAS, 'from': sender.address})
        tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
        contract = w3.eth.contract(abi=abi, address=tx_receipt.contractAddress)
        return ConvenienceContractWrapper(contract)

    return create_contract


@pytest.fixture
def root_chain(get_contract):
    return initialized_contract(get_contract, EXIT_PERIOD)


def initialized_contract(get_contract, exit_period):
    pql = get_contract('PriorityQueueLib')
    pqf = get_contract('PriorityQueueFactory', libraries={'PriorityQueueLib': pql.address})
    contract = get_contract('RootChain', libraries={'PriorityQueueFactory': pqf.address})
    contract.init(exit_period)
    return contract


@pytest.fixture
def token(get_contract):
    return get_contract('MintableToken')


@pytest.fixture
def testlang(root_chain, w3, accounts):
    return TestingLanguage(root_chain, w3, accounts)


@pytest.fixture
def root_chain_short_exit_period(get_contract):
    return initialized_contract(get_contract, 0)


@pytest.fixture
def testlang_root_chain_short_exit_period(root_chain_short_exit_period, w3, accounts):
    return TestingLanguage(root_chain_short_exit_period, w3, accounts)


@pytest.fixture
def utxo(testlang):
    return testlang.create_utxo()


# def watch_contract(ethtester, path, address):
#     abi, _ = deployer.builder.get_contract_data(path)
#     return ethtester.ABIContract(ethtester.chain, abi, address)
#
#


def _encode_libs(libraries):
    return {
        libname + '.sol' + ':' + libname: libaddress
        for libname, libaddress in libraries.items()
    }


def assert_event(event, event_name, event_args=None):
    if event_args is None:
        event_args = {}

    assert event['event'] == event_name
    assert event_args.items() <= event['args'].items()
