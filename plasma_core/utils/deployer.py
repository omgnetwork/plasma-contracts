from web3.contract import ConciseContract
from web3 import Web3, HTTPProvider


class Deployer(object):

    def __init__(self, builder, provider=HTTPProvider('http://localhost:8545')):
        self.builder = builder
        self.w3 = Web3(provider)

    def deploy_contract(self, contract_name, gas=5000000, args=(), concise=True):
        """Deploys a contract to the given Ethereum network using Web3

        Args:
            contract_name (str): Name of the contract to deploy. Must already be compiled.
            provider (HTTPProvider): The Web3 provider to deploy with.
            gas (int): Amount of gas to use when creating the contract.
            args (obj): Any additional arguments to include with the contract creation.
            concise (bool): Whether to return a Contract or ConciseContract instance.

        Returns:
            Contract: A Web3 contract instance.
        """

        abi, bytecode = self.builder.get_contract_data(contract_name)

        contract = self.w3.eth.contract(abi=abi, bytecode=bytecode)

        # Get transaction hash from deployed contract
        tx_hash = contract.deploy(transaction={
            'from': self.w3.eth.accounts[0],
            'gas': gas
        }, args=args)

        # Get tx receipt to get contract address
        tx_receipt = self.w3.eth.getTransactionReceipt(tx_hash)
        contract_address = tx_receipt['contractAddress']

        contract_instance = self.w3.eth.contract(address=contract_address, abi=abi)

        print("Successfully deployed {0} contract!".format(contract_name))

        return ConciseContract(contract_instance) if concise else contract_instance

    def get_contract_at_address(self, contract_name, address, concise=True):
        """Returns a Web3 instance of the given contract at the given address

        Args:
            contract_name (str): Name of the contract. Must already be compiled.
            address (str): Address of the contract.
            concise (bool): Whether to return a Contract or ConciseContract instance.

        Returns:
            Contract: A Web3 contract instance.
        """

        abi, _ = self.builder.get_contract_data(contract_name)

        contract_instance = self.w3.eth.contract(abi=abi, address=address)

        return ConciseContract(contract_instance) if concise else contract_instance
