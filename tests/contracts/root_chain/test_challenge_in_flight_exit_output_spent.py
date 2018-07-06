import pytest
from ethereum.tools.tester import TransactionFailed


def test_challenge_in_flight_exit_output_spent_should_succeed(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1.key], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1.key)
    testlang.forward_to_period(2)

    testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2.key)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.output_piggybacked(0)


def test_challenge_in_flight_exit_output_spent_wrong_period_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1.key], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1.key)
    testlang.forward_to_period(1)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2.key)


def test_challenge_in_flight_exit_output_spent_not_piggybacked_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1.key], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2.key)


def test_challenge_in_flight_exit_output_spent_unrelated_tx_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id_1 = testlang.deposit(owner_1.address, amount)
    deposit_id_2 = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo([deposit_id_1], [owner_1.key], [(owner_1.address, 100)])
    unrelated_spend_id = testlang.spend_utxo([deposit_id_2], [owner_1.key])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1.key)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, unrelated_spend_id, 0, owner_2.key)


def test_challenge_in_flight_exit_output_spent_invalid_signature_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_2.key], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1.key)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2.key)


def test_challenge_in_flight_exit_output_spent_invalid_proof_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1.key], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1.key)
    testlang.forward_to_period(2)

    in_flight_tx = testlang.child_chain.get_transaction(spend_id)
    spending_tx = testlang.child_chain.get_transaction(double_spend_id)
    in_flight_tx_inclusion_proof = b''
    spending_tx_sig = spending_tx.signatures[0]
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeInFlightExitOutputSpent(in_flight_tx.encoded, spend_id, in_flight_tx_inclusion_proof, spending_tx.encoded, 0, spending_tx_sig, sender=owner_2.key)
