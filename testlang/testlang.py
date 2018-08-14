from ethereum.utils import sha3
from plasma_core.child_chain import ChildChain
from plasma_core.account import EthereumAccount
from plasma_core.block import Block
from plasma_core.transaction import Transaction
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.signatures import sign
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from plasma_core.utils.address import address_to_hex


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


class PlasmaExit(object):
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
        self.confirmations = {}

    @property
    def timestamp(self):
        """Current chain timestamp"""
        return self.ethtester.chain.head_state.timestamp

    def deposit(self, owner, amount):
        """Creates a deposit transaction for a given owner and amount.

        Args:
            owner (EthereumAccount): Account to own the deposit.
            amount (int): Deposit amount.

        Returns:
            int: Unique identifier of the deposit.
        """

        deposit_tx = Transaction(0, 0, 0,
                                 0, 0, 0,
                                 NULL_ADDRESS,
                                 owner.address, amount,
                                 NULL_ADDRESS, 0)

        blknum = self.root_chain.getDepositBlock()
        self.root_chain.deposit(value=amount, sender=owner.key)

        block = Block(transaction_set=[deposit_tx], number=blknum)
        self.child_chain.add_block(block)
        return blknum

    def deposit_token(self, owner, token, amount):
        """Mints, approves and deposits token for given owner and amount

        Args:
            owner (EthereumAccount): Account to own the deposit.
            token (Contract: ERC20, MintableToken): Token to be deposited.
            amount (int): Deposit amount.

        Returns:
            int: Unique identifier of the deposit.
        """

        deposit_tx = Transaction(0, 0, 0,
                                 0, 0, 0,
                                 token.address,
                                 owner.address, amount,
                                 NULL_ADDRESS, 0)

        token.mint(owner.address, amount)
        self.ethtester.chain.mine()
        token.approve(self.root_chain.address, amount, sender=owner.key)
        self.ethtester.chain.mine()
        blknum = self.root_chain.getDepositBlock()
        self.root_chain.depositFrom(owner.address, token.address, amount, sender=owner.key)

        block = Block(transaction_set=[deposit_tx], number=blknum)
        self.child_chain.add_block(block)
        return blknum

    def spend_utxo(self, utxo_id, new_owner, amount, signer):
        """Creates a spending transaction and inserts it into the chain.

        Args:
            utxo_id (int): Identifier of the UTXO to spend.
            new_owner (EthereumAccount): Account to own the output of this spend.
            amount (int): Amount to spend.
            signer (EthereumAccount): Account to sign this transaction.

        Returns:
            int: Unique identifier of the spend.
        """

        utxo = self.child_chain.get_transaction(utxo_id)
        spend_tx = Transaction(*decode_utxo_id(utxo_id),
                               0, 0, 0,
                               utxo.cur12,
                               new_owner.address, amount,
                               NULL_ADDRESS, 0)
        spend_tx.sign1(signer.key)

        blknum = self.root_chain.currentChildBlock()
        block = Block(transaction_set=[spend_tx], number=blknum)
        block.sign(self.operator.key)
        self.root_chain.submitBlock(block.root)
        self.child_chain.add_block(block)
        return encode_utxo_id(blknum, 0, 0)

    def confirm_spend(self, tx_id, signer):
        """Signs a confirmation signature for a spend.

        Args:
            tx_id (int): Identifier of the transaction.
            signer (EthereumAccount): Account to sign this confirmation.
        """

        spend_tx = self.child_chain.get_transaction(tx_id)
        (blknum, _, _) = decode_utxo_id(tx_id)
        block = self.child_chain.blocks[blknum]
        confirmation_hash = sha3(spend_tx.hash + block.root)
        self.confirmations[tx_id] = sign(confirmation_hash, signer.key)

    def start_deposit_exit(self, owner, blknum, amount, token_addr=NULL_ADDRESS):
        """Starts an exit for a deposit.

        Args:
            owner (EthereumAccount): Account that owns this deposit.
            blknum (int): Deposit block number.
            amount (int): Deposit amount.
        """

        deposit_id = encode_utxo_id(blknum, 0, 0)
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

    def start_exit(self, owner, utxo_id):
        """Starts a standard exit.

        Args:
            owner (EthereumAccount): Account to attempt the exit.
            utxo_id (int): Unique identifier of the UTXO to be exited.
        """

        spend_tx = self.child_chain.get_transaction(utxo_id)
        (blknum, _, _) = decode_utxo_id(utxo_id)
        block = self.child_chain.blocks[blknum]
        proof = block.merklized_transaction_set.create_membership_proof(spend_tx.merkle_hash)
        sigs = spend_tx.sig1 + spend_tx.sig2 + self.confirmations[utxo_id]
        self.root_chain.startExit(utxo_id, spend_tx.encoded, proof, sigs, sender=owner.key)

    def challenge_exit(self, utxo_id, spend_id):
        """Challenges an exit with a double spend.

        Args:
            utxo_id (int): Identifier of the UTXO being exited.
            spend_id (int): Identifier of the transaction that spent the UTXO.
        """

        self.root_chain.challengeExit(spend_id, *self.get_challenge_proof(utxo_id, spend_id))

    def finalize_exits(self, token=NULL_ADDRESS):
        """Finalizes any exits that have completed the exit period"""

        self.root_chain.finalizeExits(token)

    def get_challenge_proof(self, utxo_id, spend_id):
        """Returns information required to submit a challenge.

        Args:
            utxo_id (int): Identifier of the UTXO being exited.
            spend_id (int): Identifier of the transaction that spent the UTXO.

        Returns:
            int, bytes, bytes, bytes, bytes: Information necessary to create a challenge proof.
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
        confirmation_sig = self.confirmations[spend_id]
        return (input_index, spend_tx.encoded, proof, sigs, confirmation_sig)

    def get_plasma_block(self, blknum):
        """Queries a plasma block by its number.

        Args:
            blknum (int): Plasma block number to query.

        Returns:
            PlasmaBlock: Formatted plasma block information.
        """

        block_info = self.root_chain.childChain(blknum)
        return PlasmaBlock(*block_info)

    def get_plasma_exit(self, utxo_id):
        """Queries a plasma exit by its ID.

        Args:
            utxo_id (int): Identifier of the exit to query.

        Returns:
            PlasmaExit: Formatted plasma exit information.
        """

        exit_info = self.root_chain.exits(utxo_id)
        return PlasmaExit(*exit_info)

    def get_balance(self, account):
        """Queries the balance of an account.

        Args:
            account (EthereumAccount): Account to query,

        Returns:
            int: The account's balance.
        """

        return self.ethtester.chain.head_state.get_balance(account.address)

    def forward_timestamp(self, amount):
        """Forwards the chain's timestamp.

        Args:
            amount (int): Number of seconds to move forward time.
        """

        self.ethtester.chain.head_state.timestamp += amount
