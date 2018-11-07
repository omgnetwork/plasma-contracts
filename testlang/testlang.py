from plasma_core.child_chain import ChildChain
from plasma_core.account import EthereumAccount
from plasma_core.block import Block
from plasma_core.transaction import Transaction
from plasma_core.transaction_v2 import Transaction as TransactionV2
from plasma_core.block_v2 import Block as BlockV2
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.signatures import sign
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from plasma_core.utils.address import address_to_hex
from plasma_core.utils.merkle.fixed_merkle import FixedMerkle
from ethereum.utils import sha3
import conftest


def get_accounts(ethtester):
    """Converts ethereum.tools.tester accounts into a list.

    Args:
        ethtester (ethereum.tools.tester): Ethereum tester instance.

    Returns:
        EthereumAccount[]: A list of EthereumAccounts.
    """

    accounts = []
    for i in range(10):
        address = getattr(ethtester, 'a{0}'.format(i))
        key = getattr(ethtester, 'k{0}'.format(i))
        accounts.append(EthereumAccount(address_to_hex(address), key))
    return accounts


class InFlightExit(object):
    
    def __init__(self, root_chain, in_flight_tx, exit_start_timestamp, exit_map, bond_owner, oldest_competitor):
        self.root_chain = root_chain
        self.in_flight_tx = in_flight_tx
        self.exit_start_timestamp = exit_start_timestamp
        self.exit_map = exit_map
        self.bond_owner = bond_owner
        self.oldest_competitor = oldest_competitor
        self.inputs = {}
        self.outputs = {}

    @property
    def challenge_flag_set(self):
        return self.root_chain.flagSet(self.exit_start_timestamp)

    def get_input(self, index):
        input_info = self.inputs.get(index)
        if not input_info:
            input_info = TransactionOutput(*self.root_chain.getInFlightExitOutput(self.in_flight_tx.encoded, index))
            input_info.owner = address_to_hex(input_info.owner)
            self.inputs[index] = input_info
        return input_info

    def get_output(self, index):
        return self.get_input(index + 4)

    def input_piggybacked(self, index):
        return (self.exit_map >> index & 1) == 1

    def output_piggybacked(self, index):
        return self.input_piggybacked(index + 4)


class StandardExit(object):
    """Represents a Plasma exit.

    Attributes:
        owner (str): Address of the exit's owner.
        token (str): Address of the token being exited.
        amount (int): How much value is being exited.
    """

    def __init__(self, owner, token, amount):
        self.owner = owner
        self.token = token
        self.amount = amount


class PlasmaBlock(object):
    """Represents a Plasma block.

    Attributes:
        root (str): Root hash of the block.
        timestamp (int): Time when the block was created.
    """

    def __init__(self, root, timestamp):
        self.root = root
        self.timestamp = timestamp


class TestingLanguage(object):
    """Represents the testing language.

    Attributes:
        root_chain (ABIContract): Root chain contract instance.
        eththester (tester): Ethereum tester instance.
        accounts (EthereumAccount[]): List of available accounts.
        operator (EthereumAccount): The operator's account.
        child_chain (ChildChain): Child chain instance.
        confirmations (dict): A mapping from transaction IDs to confirmation signatures.
    """

    def __init__(self, root_chain, ethtester):
        self.root_chain = root_chain
        self.ethtester = ethtester
        self.accounts = get_accounts(ethtester)
        self.operator = self.accounts[0]
        self.child_chain = ChildChain(self.accounts[0].address)

        # morevp semantic
        self.root_chain.blocks = self.root_chain.childChain

    @property
    def timestamp(self):
        """Current chain timestamp"""
        return self.ethtester.chain.head_state.timestamp


    def submit_block(self, transactions, signer=None, force_invalid=False):
        signer = signer or self.operator
        blknum = self.root_chain.currentChildBlock()
        if transactions and hasattr(transactions[0], "outputs"):
            block = BlockV2(transactions, number=blknum)
        else:
            block = Block(transactions, number=blknum)
        block.sign(signer.key)
        self.root_chain.submitBlock(block.root, sender=signer.key)
        if force_invalid:
            self.child_chain.blocks[self.child_chain.next_child_block] = block
            self.child_chain.next_deposit_block = self.child_chain.next_child_block + 1
            self.child_chain.next_child_block += self.child_chain.child_block_interval
        else:
            assert self.child_chain.add_block(block)
        return blknum


    def deposit(self, owner, amount):
        deposit_tx = TransactionV2(outputs=[(owner.address, amount)])
        blknum = self.root_chain.getDepositBlockNumber()
        self.root_chain.deposit(value=amount)
        deposit_id = encode_utxo_id(blknum, 0, 0)
        block = Block([deposit_tx], number=blknum)
        self.child_chain.add_block(block)
        return deposit_id

    # def deposit_pre_morevp(self, owner, amount):
    #     """Creates a deposit transaction for a given owner and amount.

    #     Args:
    #         owner (EthereumAccount): Account to own the deposit.
    #         amount (int): Deposit amount.

    #     Returns:
    #         int: Unique identifier of the deposit.
    #     """

    #     deposit_tx = Transaction(0, 0, 0,
    #                              0, 0, 0,
    #                              NULL_ADDRESS,
    #                              owner.address, amount,
    #                              NULL_ADDRESS, 0)

    #     blknum = self.root_chain.getDepositBlock()
    #     pre_balance = self.get_balance(self.root_chain)
    #     self.root_chain.deposit(value=amount, sender=owner.key)
    #     balance = self.get_balance(self.root_chain)
    #     assert balance == pre_balance + amount

    #     block = Block(transaction_set=[deposit_tx], number=blknum)
    #     self.child_chain.add_block(block)
    #     return blknum

    def deposit_token(self, owner, token, amount):
        """Mints, approves and deposits token for given owner and amount

        Args:
            owner (EthereumAccount): Account to own the deposit.
            token (Contract: ERC20, MintableToken): Token to be deposited.
            amount (int): Deposit amount.

        Returns:
            int: Unique identifier of the deposit.
        """

        deposit_tx = TransactionV2(outputs=[(owner.address, amount, token.address)])

        token.mint(owner.address, amount)
        self.ethtester.chain.mine()
        token.approve(self.root_chain.address, amount, sender=owner.key)
        self.ethtester.chain.mine()
        blknum = self.root_chain.getDepositBlockNumber()
        pre_balance = self.get_balance(self.root_chain, token)
        self.root_chain.depositFrom(token.address, amount, sender=owner.key)
        balance = self.get_balance(self.root_chain, token)
        assert balance == pre_balance + amount

        block = Block(transaction_set=[deposit_tx], number=blknum)
        self.child_chain.add_block(block)
        return encode_utxo_id(blknum, 0, 0)

    # def spend_utxo(self, utxo_id, new_owner, amount, signer, force_invalid=False, auto_confirm=True):
    #     """Creates a spending transaction and inserts it into the chain.

    #     Args:
    #         utxo_id (int): Identifier of the UTXO to spend.
    #         new_owner (EthereumAccount): Account to own the output of this spend.
    #         amount (int): Amount to spend.
    #         signer (EthereumAccount): Account to sign this transaction.
    #         force_invalid (Bool) : Skip validity checks
    #         auto_confirm (Bool) : Generate confirmation sig when mining block.

    #     Returns:
    #         int: Unique identifier of the spend.
    #     """

    #     utxo = self.child_chain.get_transaction(utxo_id)
    #     spend_tx = Transaction(*decode_utxo_id(utxo_id),
    #                            0, 0, 0,
    #                            utxo.cur12,
    #                            new_owner.address, amount,
    #                            NULL_ADDRESS, 0)
    #     spend_tx.sign1(signer.key)
    #     blknum = self.submit_block([spend_tx], force_invalid=force_invalid)
    #     tx_id = encode_utxo_id(blknum, 0, 0)
    #     if auto_confirm:
    #         self.confirm_spend(tx_id, signer)
    #     return tx_id


    def spend_utxo(self, input_ids, keys, outputs=[], force_invalid=False):
        inputs = [decode_utxo_id(input_id) for input_id in input_ids]
        spend_tx = TransactionV2(inputs=inputs, outputs=outputs)
        for i in range(0, len(inputs)):
            spend_tx.sign(i, keys[i])
        blknum = self.submit_block([spend_tx], force_invalid=force_invalid)
        spend_id = encode_utxo_id(blknum, 0, 0)
        return spend_id



    def create_utxo(self, token=NULL_ADDRESS):
        class Utxo(object):
            def __init__(self, deposit_id, owner, token, amount, spend, spend_id):
                self.deposit_id = deposit_id
                self.owner = owner
                self.amount = amount
                self.token = token
                self.spend_id = spend_id
                self.spend = spend

        owner, amount = self.accounts[0], 100
        if token == NULL_ADDRESS:
            deposit_id = self.deposit(owner, amount)
            token_address = NULL_ADDRESS
        else:
            deposit_id = self.deposit_token(owner, token, amount)
            token_address = token.address
        spend_id = self.spend_utxo([deposit_id], [owner.key], [(owner.address, 100, token_address)])
        spend = self.child_chain.get_transaction(spend_id)
        return Utxo(deposit_id, owner, token_address, amount, spend, spend_id)

    def start_deposit_exit(self, owner, deposit_id, amount, token_addr=NULL_ADDRESS):
        """Starts an exit for a deposit.

        Args:
            owner (EthereumAccount): Account that owns this deposit.
            blknum (int): Deposit block number.
            amount (int): Deposit amount.
        """

        self.root_chain.startDepositExit(deposit_id, token_addr, amount, sender=owner.key)

    def start_fee_exit(self, operator, amount):
        """Starts a fee exit.

        Args:
            operator (EthereumAccount): Account to attempt the fee exit.
            amount (int): Amount to exit.

        Returns:
            int: Unique identifier of the exit.
        """

        fee_exit_id = self.root_chain.currentFeeExit()
        self.root_chain.startFeeExit(NULL_ADDRESS, amount, sender=operator.key)
        return fee_exit_id

    def start_standard_exit(self, owner, utxo_id, sender=None):
        """Starts a standard exit.

        Args:
            owner (EthereumAccount): Account to attempt the exit.
            utxo_id (int): Unique identifier of the UTXO to be exited.
        """

        if sender is None:
            sender = owner
        spend_tx = self.child_chain.get_transaction(utxo_id)
        (blknum, _, _) = decode_utxo_id(utxo_id)
        block = self.child_chain.blocks[blknum]
        
        if hasattr(spend_tx, "outputs"):
            merkle = FixedMerkle(16, [spend_tx.encoded])
            proof = block.merklized_transaction_set.create_membership_proof(spend_tx.encoded)
            signatures = b"".join(spend_tx.signatures)
        else:
            proof = block.merklized_transaction_set.create_membership_proof(spend_tx.merkle_hash)
            signatures = spend_tx.sig1 + spend_tx.sig2
        self.root_chain.startExit(utxo_id, spend_tx.encoded, proof, sender=sender.key)

    def challenge_standard_exit(self, utxo_id, spend_id):
        """Challenges an exit with a double spend.

        Args:
            utxo_id (int): Identifier of the UTXO being exited.
            spend_id (int): Identifier of the transaction that spent the UTXO.
        """

        self.root_chain.challengeExit(spend_id, *self.get_challenge_proof(utxo_id, spend_id))

    def finalize_exits(self, token, utxo_id, count, **kwargs):
        """Finalizes exits that have completed the exit period.

        Args:
            token (address): Address of the token to be processed.
            utxo_id (int): Identifier of the UTXO being exited.
            count (int): Maximum number of exits to be processed.
        """

        self.root_chain.finalizeExits(token, utxo_id, count, **kwargs)

    def get_challenge_proof(self, utxo_id, spend_id):
        """Returns information required to submit a challenge.

        Args:
            utxo_id (int): Identifier of the UTXO being exited.
            spend_id (int): Identifier of the transaction that spent the UTXO.

        Returns:
            int, bytes, bytes, bytes: Information necessary to create a challenge proof.
        """

        spend_tx = self.child_chain.get_transaction(spend_id)
        inputs = [(spend_tx.blknum1, spend_tx.txindex1, spend_tx.oindex1), (spend_tx.blknum2, spend_tx.txindex2, spend_tx.oindex2)]
        try:
            input_index = inputs.index(decode_utxo_id(utxo_id))
        except ValueError:
            input_index = 0
        (blknum, _, _) = decode_utxo_id(spend_id)
        block = self.child_chain.blocks[blknum]
        proof = block.merklized_transaction_set.create_membership_proof(spend_tx.merkle_hash)
        sigs = spend_tx.sig1 + spend_tx.sig2
        return (input_index, spend_tx.encoded, proof, sigs)

    def get_plasma_block(self, blknum):
        """Queries a plasma block by its number.

        Args:
            blknum (int): Plasma block number to query.

        Returns:
            PlasmaBlock: Formatted plasma block information.
        """

        block_info = self.root_chain.childChain(blknum)
        return PlasmaBlock(*block_info)

    def get_standard_exit(self, utxo_id):
        """Queries a plasma exit by its ID.

        Args:
            utxo_id (int): Identifier of the exit to query.

        Returns:
            StandardExit: Formatted plasma exit information.
        """

        exit_info = self.root_chain.exits(utxo_id)
        return StandardExit(*exit_info)

    def get_balance(self, account, token=NULL_ADDRESS):
        """Queries ETH or token balance of an account.

        Args:
            account (EthereumAccount): Account to query,
            token (str OR ABIContract OR NULL_ADDRESS):
                MintableToken contract: its address or ABIContract representation.

        Returns:
            int: The account's balance.
        """
        if token == NULL_ADDRESS:
            return self.ethtester.chain.head_state.get_balance(account.address)
        if hasattr(token, "balanceOf"):
            return token.balanceOf(account.address)
        else:
            token_contract = conftest.watch_contract(self.ethtester, 'MintableToken', token)
            return token_contract.balanceOf(account.address)

    def forward_timestamp(self, amount):
        """Forwards the chain's timestamp.

        Args:
            amount (int): Number of seconds to move forward time.
        """

        self.ethtester.chain.head_state.timestamp += amount
