import pytest
from plasma_core.constants import NULL_ADDRESS_HEX
from ethereum.tools.tester import TransactionFailed


def test_start_standard_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    testlang.start_standard_exit(owner, spend_id)

    assert testlang.root_chain.exits(spend_id) == [owner.address, NULL_ADDRESS_HEX, amount]


def test_start_standard_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    testlang.start_standard_exit(owner, spend_id)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(owner, spend_id)


def test_start_standard_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    deposit_tx = testlang.child_chain.get_transaction(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startExit(spend_id, deposit_tx.encoded, b'')
