import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.transaction import Transaction
from plasma_core.utils.merkle.fixed_merkle import FixedMerkle


def test_deposit_valid_values_should_succeed(ethtester, testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    deposit_tx = testlang.child_chain.get_transaction(deposit_id)

    merkle = FixedMerkle(16, [deposit_tx.encoded])

    assert testlang.root_chain.blocks(1) == [merkle.root, ethtester.chain.head_state.timestamp]
    assert testlang.root_chain.nextDepositBlock() == 2


def test_deposit_invalid_value_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, amount)])

    with pytest.raises(TransactionFailed):
        testlang.root_chain.deposit(deposit_tx.encoded, value=0)


def test_deposit_invalid_format_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_tx = Transaction(outputs=[(owner.address, amount), (owner.address, amount)])

    with pytest.raises(TransactionFailed):
        testlang.root_chain.deposit(deposit_tx.encoded, value=amount)
