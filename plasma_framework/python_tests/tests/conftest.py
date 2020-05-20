import itertools
import os

import pytest
from eth_keys.datatypes import PrivateKey
from solc_simple import Builder
from solcx import link_code, set_solc_version_pragma
from web3 import Web3, HTTPProvider
from web3.main import get_default_modules
from xprocess import ProcessStarter

from plasma_core.account import EthereumAccount
from plasma_core.constants import NULL_ADDRESS
from testlang.testlang import TestingLanguage
from tests_utils.constants import (
    INITIAL_ETH,
    START_GAS,
    GAS_LIMIT,
)
from tests_utils.convenience_wrappers import ConvenienceContractWrapper, AutominingEth
from tests_utils.deployer import Deployer
from tests_utils.plasma_framework import PlasmaFramework


# IMPORTANT NOTICE
# Whenever we pass to or receive from web3 an address, we do it in checksum format.
# On the other hand, in plasma (transactions, blocks, etc.) we should pass addresses in binary form (canonical address).


# Compile contracts before testing

OWN_DIR = os.path.dirname(os.path.realpath(__file__))
CONTRACTS_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../../contracts')))
OUTPUT_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../build')))
OPENZEPPELIN_DIR = os.path.abspath(os.path.realpath(os.path.join(OWN_DIR, '../openzeppelin-solidity')))
set_solc_version_pragma('0.5.11')
builder = Builder(CONTRACTS_DIR, OUTPUT_DIR)
builder.compile_all(allow_paths="*,",
                    import_remappings=[f"openzeppelin-solidity={OPENZEPPELIN_DIR}"],
                    optimize=True,
                    optimize_runs=200)
deployer = Deployer(builder)


@pytest.fixture(scope="session")
def accounts():
    _accounts = []
    for i in range(1, 11):
        pk = PrivateKey(i.to_bytes(32, byteorder='big'))
        _accounts.append(EthereumAccount(pk.public_key.to_checksum_address(), pk))
    return _accounts


def ganache_initial_accounts_args(accounts):
    return [f"--account=\"{acc.key.to_hex()},{INITIAL_ETH}\"" for acc in accounts]


def parse_worker_no(worker_id):
    worker_no = 0
    try:
        worker_no = int(worker_id[2:])
    except ValueError:
        pass
    return worker_no


@pytest.fixture(scope="session")
def ganache_port(worker_id):
    default_port = 8545
    worker_no = parse_worker_no(worker_id)
    return default_port + worker_no


def ganache_cli(accounts, port):
    accounts_args = ganache_initial_accounts_args(accounts)

    class Starter(ProcessStarter):
        pattern = "Listening on .*"
        args = ["ganache-cli",
                f"--port={port}",
                f"--gasLimit={GAS_LIMIT}",
                "--time=0",
                "--blockTime=0",
                ] + accounts_args

        def filter_lines(self, lines):
            return itertools.islice(lines, 100)

    return Starter


@pytest.fixture(scope="session")
def _w3_session(xprocess, accounts, ganache_port):
    web3_modules = get_default_modules()
    web3_modules.update(eth=(AutominingEth,))

    _w3 = Web3(HTTPProvider(endpoint_uri=f'http://localhost:{ganache_port}', request_kwargs={'timeout': 600}), modules=web3_modules)
    if not _w3.isConnected():  # try to connect to an external ganache
        xprocess.ensure(f'GANACHE_{ganache_port}', ganache_cli(accounts, ganache_port))
        assert _w3.provider.make_request('miner_stop', [])['result']

    _w3.eth.defaultAccount = _w3.eth.accounts[0]

    yield _w3

    xprocess.getinfo(f'GANACHE_{ganache_port}').terminate()


@pytest.fixture
def w3(_w3_session):
    yield _w3_session
    _w3_session.eth.enable_auto_mine()


@pytest.fixture
def get_contract(w3, accounts):
    def create_contract(path, args=(), sender=accounts[0], libraries=None):
        if libraries is None:
            libraries = dict()
        abi, hexcode = deployer.builder.get_contract_data(path)

        libraries = _encode_libs(libraries)
        linked_hexcode = link_code(hexcode, libraries)[0:-len("\nLinking completed.")]  # trim trailing text
        factory = w3.eth.contract(abi=abi, bytecode=linked_hexcode)
        tx_hash = factory.constructor(*args).transact({'gas': START_GAS, 'from': sender.address})
        tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
        contract = w3.eth.contract(abi=abi, address=tx_receipt.contractAddress)
        return ConvenienceContractWrapper(contract)

    return create_contract


@pytest.fixture
def plasma_framework(get_contract, accounts, token):
    framework = PlasmaFramework(get_contract, maintainer=accounts[-1], authority=accounts[0])
    framework.addExitQueue(framework.erc20_vault_id, token.address)
    framework.addExitQueue(framework.eth_vault_id, NULL_ADDRESS)
    return framework


def initialized_contract(get_contract, exit_period, immune_vaults, immune_exit_games):
    contract = get_contract('PlasmaFramework', args=[exit_period, immune_vaults, immune_exit_games])
    return contract


@pytest.fixture
def testlang(plasma_framework, w3, accounts):
    return TestingLanguage(plasma_framework, w3, accounts)


@pytest.fixture(params=["ERC20Mintable"])
def token(get_contract, request):
    return get_contract(request.param)


@pytest.fixture(params=["ERC20Mintable"])
def no_exit_queue_token(get_contract, request):
    return get_contract(request.param)


@pytest.fixture
def utxo(testlang):
    return testlang.create_utxo()


def _encode_libs(libraries):
    libs = dict()
    for lib_name, lib_address in libraries.items():
        file_path = _find_file(lib_name + ".sol", CONTRACTS_DIR)
        libs[file_path + ":" + lib_name] = lib_address
    return libs


def _find_file(name, path):
    for root, dirs, files in os.walk(path):
        if name in files:
            return os.path.join(root, name)
    raise FileNotFoundError(name)
