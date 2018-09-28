import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS_HEX


def test_challenge_standard_exit_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id)
    doublespend_id = testlang.spend_utxo(spend_id, owner, amount, owner)

    testlang.challenge_standard_exit(spend_id, doublespend_id)

    assert testlang.root_chain.exits(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 100]


def test_challenge_standard_exit_invalid_spend_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner_1, 100, owner_1)

    testlang.start_standard_exit(owner_1, spend_id)
    fake_challenge_id = testlang.spend_utxo(spend_id, owner_2, 100, owner_2, force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(spend_id, fake_challenge_id)


def test_challenge_standard_exit_unrelated_spend_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id_1 = testlang.deposit(owner.address, amount)
    spend_id_1 = testlang.spend_utxo(deposit_id_1, owner, amount, owner)
    testlang.start_standard_exit(owner, spend_id_1)

    deposit_id_2 = testlang.deposit(owner.address, amount)
    spend_id_2 = testlang.spend_utxo(deposit_id_2, owner, amount, owner)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id_1, spend_id_2)


def test_challenge_standard_exit_not_started_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)


def test_restarting_challenged_exit_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)

    testlang.start_standard_exit(owner, spend_id)
    doublespend_id = testlang.spend_utxo(spend_id, owner, 100, owner)

    testlang.challenge_standard_exit(spend_id, doublespend_id)

    assert testlang.root_chain.exits(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 100]

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(owner, spend_id)
