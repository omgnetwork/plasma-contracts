import pytest
from eth_tester.exceptions import TransactionFailed

from plasma_core.block import Block
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from plasma_core.transaction import Transaction
from plasma_core.utils.merkle.fixed_merkle import FixedMerkle


def test_deposit_valid_values_should_succeed(testlang, w3):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    deposit_tx = testlang.child_chain.get_transaction(deposit_id)

    merkle = FixedMerkle(16, [deposit_tx.encoded])

    assert testlang.root_chain.blocks(1) == [merkle.root, testlang.timestamp]
    assert testlang.root_chain.nextDepositBlock() == 2


def test_deposit_invalid_value_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, NULL_ADDRESS, amount)])

    with pytest.raises(TransactionFailed):
        testlang.root_chain.deposit(deposit_tx.encoded, value=0)


def test_deposit_zero_amount_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 0

    deposit_id = testlang.deposit(owner, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == testlang.child_chain.get_block(deposit_blknum).root
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.nextDepositBlock() == 2


def test_deposit_with_multiple_output_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, NULL_ADDRESS, amount), (owner.address, NULL_ADDRESS, amount)])

    with pytest.raises(TransactionFailed):
        testlang.root_chain.deposit(deposit_tx.encoded, value=amount)


def test_deposit_with_input_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(inputs=[(1, 0, 0)], outputs=[(owner.address, NULL_ADDRESS, amount)])

    with pytest.raises(TransactionFailed):
        testlang.root_chain.deposit(deposit_tx.encoded, value=amount)


@pytest.mark.slow
def test_at_most_999_deposits_per_child_block(testlang, w3):
    owner = testlang.accounts[0]
    child_block_interval = testlang.root_chain.CHILD_BLOCK_INTERVAL()
    w3.provider.ethereum_tester.disable_auto_mine_transactions()
    blknum = testlang.root_chain.getDepositBlockNumber()
    for i in range(0, child_block_interval - 1):
        deposit_id = _deposit(testlang, owner, 1, blknum + i)
        if i % 25 == 0:
            w3.provider.ethereum_tester.mine_block()

    with pytest.raises(TransactionFailed):
        testlang.deposit(owner, 1)

    testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, 1)])
    testlang.deposit(owner, 1)


def test_token_deposit_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit_token(owner, token, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == testlang.child_chain.get_block(deposit_blknum).root
    assert plasma_block.timestamp == testlang.timestamp
    assert root_chain.nextDepositBlock() == 2


def test_token_deposit_non_existing_token_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, NULL_ADDRESS, amount)])

    token.mint(owner.address, amount)
    token.approve(testlang.root_chain.address, amount, **{'from': owner.address})
    with pytest.raises(TransactionFailed):
        testlang.root_chain.depositFrom(deposit_tx.encoded, **{'from': owner.address})


def test_token_deposit_no_approve_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, token.address, amount)])

    token.mint(owner.address, amount)
    with pytest.raises(TransactionFailed):
        testlang.root_chain.depositFrom(deposit_tx.encoded, **{'from': owner.address})


def test_token_deposit_insufficient_approve_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, token.address, amount * 5)])

    token.mint(owner.address, amount)
    token.approve(testlang.root_chain.address, amount, **{'from': owner.address})
    with pytest.raises(TransactionFailed):
        testlang.root_chain.depositFrom(deposit_tx.encoded, **{'from': owner.address})


def _deposit(testlang, owner, amount, blknum):
    deposit_tx = Transaction(outputs=[(owner.address, NULL_ADDRESS, amount)])
    testlang.root_chain.contract.functions.deposit(deposit_tx.encoded).transact({'from': owner.address, 'value': amount})
    deposit_id = encode_utxo_id(blknum, 0, 0)
    block = Block([deposit_tx], number=blknum)
    testlang.child_chain.add_block(block)
    return deposit_id,
