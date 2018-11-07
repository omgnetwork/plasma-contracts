from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from plasma_core.utils.address import address_to_hex
from plasma_core.utils.signatures import get_signer
from plasma_core.constants import NULL_SIGNATURE
from plasma_core.exceptions import (InvalidBlockSignatureException,
                                    InvalidTxSignatureException,
                                    TxAlreadySpentException,
                                    TxAmountMismatchException)


class ChildChain(object):

    def __init__(self, operator):
        self.operator = operator
        self.blocks = {}
        self.parent_queue = {}
        self.child_block_interval = 1000
        self.next_child_block = self.child_block_interval
        self.next_deposit_block = 1

    def add_block(self, block):
        # Is the block being added to the head?
        is_next_child_block = block.number == self.next_child_block
        if is_next_child_block or block.number == self.next_deposit_block:
            # Validate the block.
            try:
                self._validate_block(block)
            except (InvalidBlockSignatureException, InvalidTxSignatureException, TxAlreadySpentException, TxAmountMismatchException):
                return False

            # Insert the block into the chain.
            self._apply_block(block)

            # Update the head state.
            self._update_headstate(is_next_child_block)
        # Or does the block not yet have a parent?
        elif block.number > self.next_deposit_block:
            parent_block_number = block.number - 1
            if parent_block_number not in self.parent_queue:
                self.parent_queue[parent_block_number] = []
            self.parent_queue[parent_block_number].append(block)
            return False
        # Block already exists.
        else:
            return False

        # Process any blocks that were waiting for this block.
        if block.number in self.parent_queue:
            for blk in self.parent_queue[block.number]:
                self.add_block(blk)
            del self.parent_queue[block.number]
        return True

    def validate_transaction(self, tx, temp_spent={}):
        input_amount = 0
        if  hasattr(tx, "outputs"):
            output_amount = sum(output.amount for output in tx.outputs)
            inputs = [(tx.inputs[0].blknum, tx.inputs[0].txindex, tx.inputs[0].oindex), (tx.inputs[1].blknum, tx.inputs[1].txindex, tx.inputs[1].oindex)]
        else:
            output_amount = tx.amount1 + tx.amount2
            inputs = [(tx.blknum1, tx.txindex1, tx.oindex1), (tx.blknum2, tx.txindex2, tx.oindex2)]

        for input_index, (blknum, txindex, oindex) in enumerate(inputs):
            # Transactions coming from block 0 are valid.
            if blknum == 0:
                continue

            input_id = encode_utxo_id(blknum, txindex, oindex)
            input_tx = self.get_transaction(input_id)

            if hasattr(input_tx, "outputs"):
                signature = tx.signatures[input_index]
                not_null_sig = signature != NULL_SIGNATURE
                correct_signer = input_tx.outputs[oindex].owner == get_signer(input_tx.hash, signature)
                spent = input_tx.spent[oindex]
                input_amount += input_tx.outputs[oindex].amount
            else:
                not_null_sig = tx.sig(input_index) 
                correct_signer = input_tx.newowner(oindex) == tx.sender(input_index)
                spent = input_tx.spent(oindex)
                input_amount += input_tx.amount(oindex)

            valid_signature = not_null_sig and correct_signer
            
            # Deposit transaction signatures are checked at the block level
            if self.blocks[blknum].is_deposit_block:
                valid_signature = True 

            # Check to see if the input is already spent.
            utxo_id = encode_utxo_id(blknum, txindex, oindex)
            if spent or utxo_id in temp_spent:
                raise TxAlreadySpentException('failed to validate tx')

            if not valid_signature:
                raise InvalidTxSignatureException('failed to validate tx')

        if not tx.is_deposit and input_amount < output_amount:
            raise TxAmountMismatchException('failed to validate tx')

    def get_block(self, blknum):
        return self.blocks[blknum]

    def get_transaction(self, transaction_id):
        (blknum, txindex, _) = decode_utxo_id(transaction_id)
        return self.blocks[blknum].transaction_set[txindex]

    def get_current_block_num(self):
        return self.next_child_block

    def _apply_transaction(self, tx):
        if hasattr(tx, "outputs"):
            inputs = [(tx.inputs[0].blknum, tx.inputs[0].txindex, tx.inputs[0].oindex), (tx.inputs[1].blknum, tx.inputs[1].txindex, tx.inputs[1].oindex)]
        else:
            inputs = [(tx.blknum1, tx.txindex1, tx.oindex1), (tx.blknum2, tx.txindex2, tx.oindex2)]
        for (blknum, txindex, oindex) in inputs:
            if blknum == 0:
                continue
            input_id = encode_utxo_id(blknum, txindex, oindex)
            input_tx = self.get_transaction(input_id)
            if hasattr(input_tx, "outputs"):
                input_tx.spent[oindex] = True
            elif oindex == 0:
                input_tx.spent1 = True
            else:
                input_tx.spent2 = True

    def _validate_block(self, block):
        # Check for a valid signature.
        if not block.is_deposit_block and (block.sig == NULL_SIGNATURE or address_to_hex(block.signer) != self.operator):
            raise InvalidBlockSignatureException('failed to validate block')

        for tx in block.transaction_set:
            self.validate_transaction(tx)

    def _apply_block(self, block):
        for tx in block.transaction_set:
            self._apply_transaction(tx)
        self.blocks[block.number] = block

    def _update_headstate(self, is_next_child_block):
        if is_next_child_block:
            self.next_deposit_block = self.next_child_block + 1
            self.next_child_block += self.child_block_interval
        else:
            self.next_deposit_block += 1

