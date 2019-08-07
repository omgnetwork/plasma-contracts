import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS


# challenge should succeed even when phase 2 of in-flight exit is over
@pytest.mark.parametrize("period", [1, 2, 4])
def test_challenge_in_flight_exit_output_spent_should_succeed(testlang, period):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.forward_to_period(period)

    testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.output_piggybacked(0)


def test_challenge_in_flight_exit_output_spent_not_piggybacked_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2)


def test_challenge_in_flight_exit_output_spent_unrelated_tx_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id_1 = testlang.deposit(owner_1, amount)
    deposit_id_2 = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id_1], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    unrelated_spend_id = testlang.spend_utxo([deposit_id_2], [owner_1])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, unrelated_spend_id, 0, owner_2)


def test_challenge_in_flight_exit_output_spent_invalid_signature_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_2], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2)


def test_challenge_in_flight_exit_output_spent_invalid_proof_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.forward_to_period(2)

    in_flight_tx = testlang.child_chain.get_transaction(spend_id)
    spending_tx = testlang.child_chain.get_transaction(double_spend_id)
    in_flight_tx_inclusion_proof = b''
    spending_tx_sig = spending_tx.signatures[0]
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeInFlightExitOutputSpent(in_flight_tx.encoded, spend_id,
                                                             in_flight_tx_inclusion_proof, spending_tx.encoded, 0,
                                                             spending_tx_sig, **{'from': owner_2.address})
