from eth_tester.exceptions import TransactionFailed
from web3 import eth
from web3._utils.datatypes import PropertyCheckingFactory
from web3.contract import Contract


class AutominingEth(eth.Eth):
    """ A simple convenience wrapper that cooperates with ganache EVM,
        so that mining transactions is automatic yet deterministic.

        Provides methods for control of mining and time forwarding.
    """

    def __init__(self, web3):
        super().__init__(web3)
        self._mine = True
        self._next_timestamp = None
        self._last_tx_hash = None

    def disable_auto_mine(self):
        self._mine = False

    def enable_auto_mine(self):
        self._mine = True

    def mine(self, timestamp=None, expect_error=False):
        timestamp = timestamp or self._get_next_timestamp()
        try:
            result = self.web3.manager.request_blocking('evm_mine', [timestamp])
            if result != "0x0":
                raise TransactionFailed("Could not mine next block")
        except ValueError as error:
            if expect_error:
                return

            if error.args[0]['message'].startswith("VM Exception while processing transaction: revert"):
                raise TransactionFailed
            raise error

    def increase_time(self, seconds):
        self._next_timestamp = self.getBlock('latest')['timestamp'] + seconds

    def sendTransaction(self, transaction):
        tx_hash = super().sendTransaction(transaction)
        if self._mine:
            self.mine()

        self._last_tx_hash = tx_hash
        return tx_hash

    @property
    def last_gas_used(self):
        receipt = self.waitForTransactionReceipt(self._last_tx_hash)
        return receipt['gasUsed']

    def _get_next_timestamp(self):
        next_timestamp = self._next_timestamp or (self.getBlock('latest')['timestamp'] + 1)
        self._next_timestamp = None
        return next_timestamp


class ConvenienceContractWrapper:
    """ Wraps web3.Contract, so that the calling of functions is simpler.

        Instead of calling:
            `contract.functions.<name_of_function>(args).transact()`
        we can simply call:
            `contract.<name_of_function>(args)`
    """

    # Gas must be preset, due to an error in ganache, which causes ganache-cli to panic
    # at gas estimation when the transaction being estimated fails.
    default_params = {'gasPrice': 0, 'gas': 4 * 10 ** 6}

    def __init__(self, contract: Contract):
        self.contract = contract

    def __getattr__(self, item):
        method = self._find_abi_method(item)
        if method:
            function = self.contract.functions.__getattribute__(item)
            return ConvenienceContractWrapper._call_or_transact(function, method)

        return self.contract.__getattribute__(item)

    def _find_abi_method(self, item):
        for i in self.contract.abi:
            if i['type'] == 'function' and i['name'] == item:
                return i

    @staticmethod
    def _call_or_transact(function, method_abi):
        def _do_call(*args):
            try:
                result = function(*args).call()
            except ValueError:
                raise TransactionFailed
            return result

        def _do_transact(*args, **kwargs):
            params = {**ConvenienceContractWrapper.default_params, **kwargs}

            tx_hash = function(*args).transact(params)
            receipt = function.web3.eth.waitForTransactionReceipt(tx_hash)
            if receipt.status == 0:
                raise TransactionFailed

            return tx_hash

        if method_abi['constant']:
            return _do_call
        else:
            return _do_transact

    def get_contract_events(self):
        contract_events = []
        for attr in dir(self.events):
            attr = getattr(self.events, attr)
            if isinstance(attr, PropertyCheckingFactory):
                contract_events.append(attr)
        return contract_events
