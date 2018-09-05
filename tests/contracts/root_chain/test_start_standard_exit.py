import pytest
from ethereum.tools.tester import TransactionFailed

from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK


def test_start_standard_exit_should_succeed(testlang, utxo):
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)
    assert testlang.root_chain.exits(utxo.spend_id) == [utxo.owner.address, NULL_ADDRESS_HEX, utxo.amount]


def test_start_standard_exit_twice_should_fail(testlang, utxo):
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id)


def test_start_standard_exit_invalid_proof_should_fail(testlang, utxo):
    spend_tx = testlang.child_chain.get_transaction(utxo.spend_id)
    with pytest.raises(TransactionFailed):
        testlang.root_chain.startExit(utxo.spend_id, spend_tx.encoded, b'')


def test_start_standard_exit_spend_without_valid_confirmation_should_fail(testlang):
    owner, owner2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner.address, amount)

    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner, auto_confirm=False)
    testlang.confirm_spend(spend_id, owner2)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(owner, spend_id)


def test_start_standard_exit_by_non_owner_should_fail(testlang, utxo):
    mallory = testlang.accounts[1]
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id, sender=mallory)


def test_start_standard_exit_unknown_token_should_fail(testlang, token):
    utxo = testlang.create_utxo(token)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id)


def test_start_standard_exit_old_utxo_has_required_exit_period_to_start_exit(testlang, utxo):
    required_exit_period = WEEK  # see tesuji blockchain design
    minimal_required_period = WEEK  # see tesuji blockchain design
    mallory = testlang.accounts[1]

    testlang.forward_timestamp(required_exit_period + minimal_required_period)

    steal_id = testlang.spend_utxo(utxo.deposit_id, mallory, utxo.amount, mallory, force_invalid=True)
    testlang.start_standard_exit(mallory, steal_id)

    testlang.forward_timestamp(minimal_required_period - 1)
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)

    [utxoPos, _] = testlang.root_chain.getNextExit(NULL_ADDRESS)
    assert utxoPos == utxo.spend_id
