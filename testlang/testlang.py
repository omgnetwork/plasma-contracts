from ethereum.utils import sha3
from plasma.child_chain.child_chain import ChildChain
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

    def __init__(self, root_chain, ethtester):
        self.root_chain = root_chain
        self.ethtester = ethtester
        self.accounts = get_accounts(ethtester)
        self.operator = self.accounts[0]
        self.child_chain = ChildChain(self.accounts[0].address)
        self.confirmations = {}

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

    def spend_utxo(self, utxo_id, new_owner, amount, signer):
        spend_tx = Transaction(*decode_utxo_id(utxo_id),
                               0, 0, 0,
                               NULL_ADDRESS,
                               new_owner.address, amount,
                               NULL_ADDRESS, 0)
        spend_tx.sign1(signer.key)

        blknum = self.root_chain.currentChildBlock()
        block = Block(transaction_set=[spend_tx], number=blknum)
        block.sign(self.operator.key)
        self.root_chain.submitBlock(block.root)
        self.child_chain.add_block(block)
        return encode_utxo_id(blknum, 0, 0)

    def confirm_spend(self, utxo_id, signer):
        spend_tx = self.child_chain.get_transaction(utxo_id)
        (blknum, _, _) = decode_utxo_id(utxo_id)
        block = self.child_chain.blocks[blknum]
        confirmation_hash = sha3(spend_tx.hash + block.root)
        self.confirmations[utxo_id] = sign(confirmation_hash, signer.key)

    def start_deposit_exit(self, owner, blknum, amount):
        deposit_id = encode_utxo_id(blknum, 0, 0)
        self.root_chain.startDepositExit(deposit_id, NULL_ADDRESS, amount, sender=owner.key)

    def start_fee_exit(self, operator, amount):
        fee_exit_id = self.root_chain.currentFeeExit()
        self.root_chain.startFeeExit(NULL_ADDRESS, amount, sender=operator.key)
        return fee_exit_id

    def start_exit(self, owner, utxo_id):
        spend_tx = self.child_chain.get_transaction(utxo_id)
        (blknum, _, _) = decode_utxo_id(utxo_id)
        block = self.child_chain.blocks[blknum]
        proof = block.merkle_tree.create_membership_proof(spend_tx.merkle_hash)
        sigs = spend_tx.sig1 + spend_tx.sig2 + self.confirmations[utxo_id]
        self.root_chain.startExit(utxo_id, spend_tx.encoded, proof, sigs, sender=owner.key)

    def challenge_exit(self, utxo_id, spend_id):
        self.root_chain.challengeExit(spend_id, *self.get_challenge_proof(utxo_id, spend_id))

    def get_challenge_proof(self, utxo_id, spend_id):
        spend_tx = self.child_chain.get_transaction(spend_id)
        inputs = [(spend_tx.blknum1, spend_tx.txindex1, spend_tx.oindex1), (spend_tx.blknum2, spend_tx.txindex2, spend_tx.oindex2)]
        try:
            input_index = inputs.index(decode_utxo_id(utxo_id))
        except ValueError:
            input_index = 0
        (blknum, _, _) = decode_utxo_id(spend_id)
        block = self.child_chain.blocks[blknum]
        proof = block.merkle_tree.create_membership_proof(spend_tx.merkle_hash)
        sigs = spend_tx.sig1 + spend_tx.sig2
        confirmation_sig = self.confirmations[spend_id]
        return (input_index, spend_tx.encoded, proof, sigs, confirmation_sig)

    def get_plasma_block(self, blknum):
        block_info = self.root_chain.childChain(blknum)
        return PlasmaBlock(*block_info)

    def get_plasma_exit(self, utxo_id):
        exit_info = self.root_chain.exits(utxo_id)
        return PlasmaExit(*exit_info)

    @property
    def timestamp(self):
        return self.ethtester.chain.head_state.timestamp
