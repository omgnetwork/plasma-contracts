from plasma_core.utils.transactions import decode_utxo_id
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
            self.__apply_block(block)

            # Update the head state.
            if is_next_child_block:
                self.next_deposit_block = self.next_child_block + 1
                self.next_child_block += self.child_block_interval
            else:
                self.next_deposit_block += 1
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
        output_amount = sum([o.amount for o in tx.outputs])

        for x in range(len(tx.inputs)):
            i = tx.inputs[x]

            # Transactions coming from block 0 are valid.
            if i.blknum == 0:
                continue

            input_tx = self.get_transaction(i.identifier)

            # Check for a valid signature.
            if tx.signatures[x] == NULL_SIGNATURE or tx.signers[x] != input_tx.outputs[i.oindex].owner:
                raise InvalidTxSignatureException('failed to validate tx')

            # Check to see if the input is already spent.
            if input_tx.spent[i.oindex] or i.identifier in temp_spent:
                raise TxAlreadySpentException('failed to validate tx')
            input_amount += input_tx.outputs[i.oindex].amount

        if not tx.is_deposit and input_amount < output_amount:
            raise TxAmountMismatchException('failed to validate tx')

    def get_block(self, blknum):
        return self.blocks[blknum]

    def get_transaction(self, transaction_id):
        (blknum, txindex, _) = decode_utxo_id(transaction_id)
        return self.blocks[blknum].transactions[txindex]

    def get_current_block_num(self):
        return self.next_child_block

    def __apply_transaction(self, tx):
        for i in tx.inputs:
            if i.blknum == 0:
                continue
            input_tx = self.get_transaction(i.identifier)
            input_tx.spent[i.oindex] = True

    def _validate_block(self, block):
        # Check for a valid signature.
        if not block.is_deposit_block and (block.signature == NULL_SIGNATURE or block.signer != self.operator.address):
            raise InvalidBlockSignatureException('failed to validate block')

        # Validate each transaction in the block.
        for tx in block.transactions:
            self.validate_transaction(tx)

    def __apply_block(self, block):
        for tx in block.transactions:
            self.__apply_transaction(tx)
        self.blocks[block.number] = block
