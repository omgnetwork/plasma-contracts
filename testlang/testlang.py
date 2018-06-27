from ethereum.utils import sha3
from plasma_core.plasma import Transaction, Block, EthereumAccount
from plasma_core.plasma.constants import NULL_SIGNATURE
from plasma_core.plasma.utils import FixedMerkle
from plasma_core.plasma.utils.address import address_to_hex
from plasma_core.plasma.utils.transactions import encode_output_id, decode_output_id, decode_tx_id
from plasma_core.plasma.utils.signatures import sign, get_null_sig_list


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
        amount (int): How much value is being exited.
    """

    def __init__(self, owner, amount):
        self.owner = owner
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
    """Mocks a Plasma client for testing.

    Attributes:
        root_chain (ABIContract): Root chain contract instance.
        eththester (tester): Ethereum tester instance.
        accounts (EthereumAccount[]): List of available accounts.
        confirmations (dict): A mapping from transaction IDs to confirmation signatures.
        transactions (dict): A mapping from transactions IDs to Transaction objects.
        blocks (dict): A mapping from block numbers to Block objects.
    """

    def __init__(self, root_chain, ethtester):
        self.root_chain = root_chain
        self.ethtester = ethtester
        self.accounts = get_accounts(ethtester)
        self.confirmations = {}
        self.transactions = {}
        self.blocks = {}

    def submit_block(self, transactions, submitter=None):
        """Submits a list of Transaction objects as a Block.

        Args:
            transactions (Transaction[]): List of transactions to submit.
            submitter (EthereumAccount): Account to submit the block.

        Returns:
            int: Block number of the submitted block.
        """

        submitter = submitter or self.accounts[0]
        block = Block(transactions)
        blknum = self.root_chain.nextChildBlock()
        self.root_chain.submitBlock(block.root, sender=submitter.key)
        self.blocks[blknum] = block
        return blknum

    def deposit(self, owner, amount):
        """Creates a deposit transaction for a given owner and amount.

        Args:
            owner (EthereumAccount): Account to own the deposit.
            amount (int): Deposit amount.

        Returns:
            int: Unique identifier of the deposit.
        """

        deposit_tx = Transaction(outputs=[(owner.address, amount)])
        blknum = self.root_chain.getDepositBlockNumber()
        self.root_chain.deposit(deposit_tx.encoded, value=amount)
        deposit_id = encode_output_id(blknum, 0, 0)
        self.transactions[deposit_id] = deposit_tx
        self.blocks[blknum] = Block([deposit_tx])
        return deposit_id

    def spend_utxo(self, inputs=[], outputs=[], signers=[]):
        """Spends a set of inputs to create some set of outputs.

        Args:
            inputs (int[]): Unique IDs of the inputs.
            outputs ((EthereumAccount, int)[]): Owners and amounts for each outputs.
            signers (EthereumAccount[]): Accounts used to sign the respective output.

        Returns:
            int: Unique identifier of the spend.
        """

        decoded_inputs = [decode_output_id(input_id) for input_id in inputs]
        decoded_outputs = [(owner.address, amount) for (owner, amount) in outputs]
        spending_tx = Transaction(inputs=decoded_inputs, outputs=decoded_outputs)
        for i in range(len(inputs)):
            spending_tx.sign(i, signers[i].key)
        blknum = self.submit_block([spending_tx])
        spend_id = encode_output_id(blknum, 0, 0)
        self.transactions[spend_id] = spending_tx
        return spend_id

    def confirm_tx(self, tx_id, input_index, signer):
        """Allows the owner of an input to confirm a transaction.

        Args:
            tx_ud (int): Unique transaction identifier.
            input_index (int): Which input to confirm.
            signer (EthereumAccount): Account to sign the confirmation signature.

        Returns:
            str: The confirmation signature in bytes form.
        """

        tx = self.transactions[tx_id]
        (blknum, _, _) = decode_output_id(tx_id)
        block = self.blocks[blknum]
        confirmation_hash = sha3(tx.encoded + block.root)
        confirmation_sig = sign(confirmation_hash, signer.key)
        if not self.confirmations.get(tx_id):
            self.confirmations[tx_id] = get_null_sig_list(4)
        self.confirmations[tx_id][input_index] = confirmation_sig
        return confirmation_sig

    def start_exit(self, output_id, owner, bond=None):
        """Starts an exit from a given output.

        Args:
            output_id (int): Unique identifier of the output.
            owner (EthereumAccount): Account that owns the output.
            bond (int): Bond amount to include.
        """

        bond = bond if bond is not None else self.root_chain.exitBond()
        output_tx = self.transactions[decode_tx_id(output_id)]
        merkle = FixedMerkle(16, [output_tx.encoded])
        proof = merkle.create_membership_proof(output_tx.encoded)
        self.root_chain.startExit(output_id, output_tx.encoded, proof, value=bond, sender=owner.key)

    def challenge_exit(self, output_id, spend_id, challenger=None):
        """Challenges an exit of a given output.

        Args:
            output_id (int): Unique identifier of the exiting output.
            spend_id (int): Unique identifier of the tx spending the output.
            challenger (EthereumAccount): Account from which to submit the challenge.
        """

        challenger = challenger or self.accounts[0]
        spend_tx = self.transactions[spend_id]
        input_index = None
        confirmation_sig = NULL_SIGNATURE
        for i in range(4):
            input_index = i
            confirmation_sig = self.confirmations.get(spend_id, get_null_sig_list(4))[i]
            if (spend_tx.inputs[i].identifier == output_id and confirmation_sig != NULL_SIGNATURE):
                break
        self.root_chain.challengeExit(output_id, spend_tx.encoded, spend_id, input_index, confirmation_sig, sender=challenger.key)

    def process_exits(self):
        """Processes any completed exits.
        """

        self.root_chain.processExits()

    def get_plasma_exit(self, output_id):
        """Returns exit data for an exiting UTXO.

        Args:
            output_id (int): Identifier of the exiting UTXO.

        Returns:
            PlasmaExit: Information about the exit.
        """

        exit_info = self.root_chain.exits(output_id)
        return PlasmaExit(*exit_info)

    def get_plasma_block(self, blknum):
        """Returns block data for a given block.

        Args:
            blknum (int): Number of the block to query.

        Returns:
            PlasmaBlock: Information about the block.
        """

        block_info = self.root_chain.blocks(blknum)
        return PlasmaBlock(*block_info)
