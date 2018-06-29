import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.plasma.constants import NULL_ADDRESS
from testlang.testlang import address_to_hex


def test_challenge_exit_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    testlang.start_exit(deposit_id, owner)
    spend_id = testlang.spend_utxo([deposit_id], [], [owner])
    testlang.confirm_tx(spend_id, 0, owner)

    testlang.challenge_exit(deposit_id, spend_id)

    plasma_exit = testlang.get_plasma_exit(deposit_id)
    assert plasma_exit.owner == address_to_hex(NULL_ADDRESS)
    assert plasma_exit.amount == 0


def test_challenge_exit_no_confirm_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    testlang.start_exit(deposit_id, owner)
    spend_id = testlang.spend_utxo([deposit_id], [], [owner])

    with pytest.raises(TransactionFailed):
        testlang.challenge_exit(deposit_id, spend_id)


def test_challenge_exit_invalid_spend_should_fail(ethtester, testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    testlang.start_exit(deposit_id, owner_1)
    spend_id = testlang.spend_utxo([deposit_id], [], [owner_2])
    testlang.confirm_tx(spend_id, 0, owner_2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_exit(deposit_id, spend_id)


def test_challenge_exit_unrelated_spend_should_fail(ethtester, testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id_1 = testlang.deposit(owner, amount)
    testlang.start_exit(deposit_id_1, owner)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id_2], [], [owner])
    testlang.confirm_tx(spend_id, 0, owner)

    with pytest.raises(TransactionFailed):
        testlang.challenge_exit(deposit_id_1, spend_id)


def test_challenge_exit_not_started_should_fail(ethtester, testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [], [owner])
    testlang.confirm_tx(spend_id, 0, owner)

    with pytest.raises(TransactionFailed):
        testlang.challenge_exit(deposit_id, spend_id)
