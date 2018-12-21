import os
import pytest
from ethereum import utils
from ethereum.tools import tester
from ethereum.abi import ContractTranslator
from ethereum.config import config_metropolis
from plasma_core.utils.address import address_to_hex
from plasma_core.utils.deployer import Deployer
from solc_simple import Builder
from testlang.testlang import TestingLanguage
from solc import link_code


GAS_LIMIT = 10000000
START_GAS = GAS_LIMIT - 1000000
config_metropolis['BLOCK_GAS_LIMIT'] = GAS_LIMIT


# Compile contracts before testing
OWN_DIR = os.path.dirname(os.path.realpath(__file__))
CONTRACTS_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../contracts')))
OUTPUT_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../build')))
builder = Builder(CONTRACTS_DIR, OUTPUT_DIR)
builder.compile_all()
deployer = Deployer(builder)


def pytest_addoption(parser):
    parser.addoption("--runslow", action="store_true",
                     default=False, help="run slow tests")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--runslow"):
        # --runslow given in cli: do not skip slow tests
        return
    skip_slow = pytest.mark.skip(reason="need --runslow option to run")
    for item in items:
        if "slow" in item.keywords:
            item.add_marker(skip_slow)


@pytest.fixture
def ethtester():
    tester.chain = tester.Chain()
    return tester


@pytest.fixture
def ethutils():
    return utils


@pytest.fixture
def get_contract(ethtester, ethutils):
    def create_contract(path, args=(), sender=ethtester.k0, libraries=dict()):
        abi, hexcode = deployer.builder.get_contract_data(path)
        encoded_args = (ContractTranslator(abi).encode_constructor_arguments(args) if args else b'')

        libraries = _encode_libs(libraries)
        linked_hexcode = link_code(hexcode, libraries)

        code = ethutils.decode_hex(linked_hexcode) + encoded_args
        address = ethtester.chain.tx(sender=sender, to=b'', startgas=START_GAS, data=code)
        return ethtester.ABIContract(ethtester.chain, abi, address)
    return create_contract


@pytest.fixture
def root_chain(ethtester, get_contract):
    pql = get_contract('PriorityQueueLib')
    pqf = get_contract('PriorityQueueFactory', libraries={'PriorityQueueLib': pql.address})
    ethtester.chain.mine()
    contract = get_contract('RootChain', libraries={'PriorityQueueFactory': pqf.address})
    ethtester.chain.mine()
    contract.init(sender=ethtester.k0)
    ethtester.chain.mine()
    return contract


@pytest.fixture
def token(ethtester, get_contract):
    contract = get_contract('MintableToken')
    ethtester.chain.mine()
    return contract


@pytest.fixture
def testlang(root_chain, ethtester):
    return TestingLanguage(root_chain, ethtester)


@pytest.fixture
def utxo(testlang):
    return testlang.create_utxo()


def watch_contract(ethtester, path, address):
    abi, _ = deployer.builder.get_contract_data(path)
    return ethtester.ABIContract(ethtester.chain, abi, address)


def _encode_libs(libraries):
    return {
        libname + '.sol' + ':' + libname: address_to_hex(libaddress)
        for libname, libaddress in libraries.items()
    }
