import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.utils.address import address_to_bytes
from plasma_core.utils.utils import get_deposit_hash
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id


def test_deposit_valid_values_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), NULL_ADDRESS, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.currentDepositBlock() == 2


def test_deposit_zero_amount_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 0

    deposit_id = testlang.deposit(owner, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), NULL_ADDRESS, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.currentDepositBlock() == 2


def test_at_most_999_deposits_per_child_block(testlang):
    owner = testlang.accounts[0]
    child_block_interval = testlang.root_chain.CHILD_BLOCK_INTERVAL()
    for i in range(0, child_block_interval - 1):
        deposit_id = testlang.deposit(owner, 1)
        if i % 50 == 0:
            testlang.ethtester.chain.mine()

    with pytest.raises(TransactionFailed):
        testlang.deposit(owner, 1)

    testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, 1)])
    testlang.deposit(owner, 1)


def test_token_deposit_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit_token(owner, token, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), token.address, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert root_chain.currentDepositBlock() == 2


def test_token_deposit_non_existing_token_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    with pytest.raises(TransactionFailed):
        testlang.root_chain.depositFrom(NULL_ADDRESS, amount, sender=owner.key)


def test_token_deposit_no_approve_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100

    token.mint(owner.address, amount)
    testlang.ethtester.chain.mine()
    with pytest.raises(TransactionFailed):
        testlang.root_chain.depositFrom(token.address, amount, sender=owner.key)


def test_token_deposit_insufficient_approve_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100

    token.mint(owner.address, amount)
    token.approve(testlang.root_chain.address, amount, sender=owner.key)
    with pytest.raises(TransactionFailed):
        testlang.root_chain.depositFrom(token.address, amount * 5, sender=owner.key)
