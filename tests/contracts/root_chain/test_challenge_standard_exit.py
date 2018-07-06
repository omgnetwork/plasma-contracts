import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS
from testlang.testlang import address_to_hex


def test_challenge_standard_exit_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    testlang.start_standard_exit(deposit_id, owner.key)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    testlang.challenge_standard_exit(deposit_id, spend_id)

    testlang.root_chain.exits(deposit_id) == [address_to_hex(NULL_ADDRESS), 0]


def test_challenge_standard_exit_invalid_spend_should_fail(ethtester, testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    testlang.start_standard_exit(deposit_id, owner_1.key)
    spend_id = testlang.spend_utxo([deposit_id], [owner_2.key], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)


def test_challenge_standard_exit_unrelated_spend_should_fail(ethtester, testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id_1 = testlang.deposit(owner.address, amount)
    testlang.start_standard_exit(deposit_id_1, owner.key)

    deposit_id_2 = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo([deposit_id_2], [owner.key])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id_1, spend_id)


def test_challenge_standard_exit_not_started_should_fail(ethtester, testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)
