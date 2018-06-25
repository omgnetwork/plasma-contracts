from ethereum.utils import sha3
from plasma_core.plasma import Transaction, Block, EthereumAccount
from plasma_core.plasma.constants import NULL_SIGNATURE
from plasma_core.plasma.utils import FixedMerkle
from plasma_core.plasma.utils.address import address_to_hex
from plasma_core.plasma.utils.transactions import encode_output_id, decode_output_id, decode_tx_id
from plasma_core.plasma.utils.signatures import sign, get_null_sig_list


def get_accounts(ethtester):
    accounts = []
    for i in range(0, 10):
        address = getattr(ethtester, 'a{0}'.format(i))
        key = getattr(ethtester, 'k{0}'.format(i))
        accounts.append(EthereumAccount(address_to_hex(address), key))
    return accounts


class PlasmaExit(object):

    def __init__(self, owner, amount):
        self.owner = owner
        self.amount = amount


class PlasmaBlock(object):

    def __init__(self, root, timestamp):
        self.root = root
        self.timestamp = timestamp


class TestingLanguage(object):

    def __init__(self, root_chain, ethtester):
        self.root_chain = root_chain
        self.ethtester = ethtester
        self.accounts = get_accounts(ethtester)
        self.confirmations = {}
        self.transactions = {}
        self.blocks = {}

    def submit_block(self, transactions, submitter=None):
        submitter = submitter or self.accounts[0]
        block = Block(transactions)
        blknum = self.root_chain.nextChildBlock()
        self.root_chain.submitBlock(block.root, sender=submitter.key)
        self.blocks[blknum] = block
        return blknum

    def deposit(self, owner, amount):
        deposit_tx = Transaction(outputs=[(owner.address, amount)])
        blknum = self.root_chain.getDepositBlockNumber()
        self.root_chain.deposit(deposit_tx.encoded, value=amount)
        deposit_id = encode_output_id(blknum, 0, 0)
        self.transactions[deposit_id] = deposit_tx
        self.blocks[blknum] = Block([deposit_tx])
        return deposit_id

    def spend_utxo(self, inputs=[], outputs=[], signers=[]):
        decoded_inputs = [decode_output_id(input_id) for input_id in inputs]
        decoded_outputs = [(owner.address, amount) for (owner, amount) in outputs]
        spending_tx = Transaction(inputs=decoded_inputs, outputs=decoded_outputs)
        for i in range(0, len(inputs)):
            spending_tx.sign(i, signers[i].key)
        blknum = self.submit_block([spending_tx])
        spend_id = encode_output_id(blknum, 0, 0)
        self.transactions[spend_id] = spending_tx
        return spend_id

    def confirm_tx(self, tx_id, input_index, signer):
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
        output_tx = self.transactions[decode_tx_id(output_id)]
        merkle = FixedMerkle(16, [output_tx.encoded])
        proof = merkle.create_membership_proof(output_tx.encoded)
        bond = bond if bond is not None else self.root_chain.exitBond()
        self.root_chain.startExit(output_id, output_tx.encoded, proof, value=bond, sender=owner.key)

    def challenge_exit(self, output_id, spend_id, challenger=None):
        challenger = challenger or self.accounts[0]
        spend_tx = self.transactions[spend_id]
        input_index = None
        confirmation_sig = NULL_SIGNATURE
        for i in range(0, 4):
            input_index = i
            confirmation_sig = self.confirmations.get(spend_id, get_null_sig_list(4))[i]
            if (spend_tx.inputs[i].identifier == output_id and confirmation_sig != NULL_SIGNATURE):
                break
        self.root_chain.challengeExit(output_id, spend_tx.encoded, spend_id, input_index, confirmation_sig, sender=challenger.key)

    def process_exits(self):
        self.root_chain.processExits()

    def get_plasma_exit(self, output_id):
        exit_info = self.root_chain.exits(output_id)
        return PlasmaExit(*exit_info)

    def get_plasma_block(self, blknum):
        block_info = self.root_chain.blocks(blknum)
        return PlasmaBlock(*block_info)
