import pytest
from plasma_core.constants import NULL_ADDRESS_HEX
from ethereum.tools.tester import TransactionFailed


def test_start_deposit_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_deposit_exit(owner, deposit_id, 100)

    assert testlang.root_chain.exits(deposit_id) == [owner.address, NULL_ADDRESS_HEX, amount]


def test_start_deposit_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_deposit_exit(owner, deposit_id, 100)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, deposit_id, 100)


def test_start_deposit_exit_invalid_amount_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.child_chain.get_transaction(deposit_id)

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startDepositExit(deposit_id, NULL_ADDRESS_HEX, 1000, sender=owner.key)


def test_start_deposit_exit_from_child_block_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, spend_id, 100)
