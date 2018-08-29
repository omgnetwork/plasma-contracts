import pytest
from ethereum.tools.tester import TransactionFailed

from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK


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


def test_start_standard_exit_by_non_owner_should_fail(testlang):
    owner, mallory, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(owner, spend_id, sender=mallory)


def test_start_standard_exit_unknown_token_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(owner, spend_id)


def test_start_standard_exit_old_utxo_has_required_exit_period_to_start_exit(testlang):
    required_exit_period = WEEK  # see tesuji blockchain design
    minimal_required_period = WEEK  # see tesuji blockchain design
    owner, mallory, amount = testlang.accounts[0], testlang.accounts[1], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id, owner)

    testlang.forward_timestamp(required_exit_period + minimal_required_period)

    steal_id = testlang.spend_utxo(deposit_id, mallory, amount, mallory, force_invalid=True)
    testlang.confirm_spend(steal_id, mallory)
    testlang.start_standard_exit(mallory, steal_id)

    testlang.forward_timestamp(minimal_required_period - 1)
    testlang.start_standard_exit(owner, spend_id)

    [utxoPos, _] = testlang.root_chain.getNextExit(NULL_ADDRESS)
    assert utxoPos == spend_id
