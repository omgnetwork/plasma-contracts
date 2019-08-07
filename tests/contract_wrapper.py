from eth_tester.exceptions import TransactionFailed
from web3._utils.datatypes import PropertyCheckingFactory
from web3.contract import Contract


class ConvenienceContractWrapper:
    default_params = {'gasPrice': 0}

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
            return function(*args).call()

        def _do_transact(*args, **kwargs):
            params = {**ConvenienceContractWrapper.default_params, **kwargs}
            tx_hash = function(*args).transact(params)
            receipt = function.web3.eth.getTransactionReceipt(tx_hash)
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
