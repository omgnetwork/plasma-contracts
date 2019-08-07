import pytest
from eth_tester.exceptions import TransactionFailed

from plasma_core.constants import NULL_ADDRESS, MIN_EXIT_PERIOD


def test_challenge_in_flight_exit_not_canonical_should_succeed(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)

    testlang.start_in_flight_exit(spend_id)

    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.bond_owner == owner_2.address
    assert in_flight_exit.oldest_competitor == double_spend_id
    assert in_flight_exit.challenge_flag_set


def test_challenge_in_flight_exit_not_canonical_wrong_period_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)

    testlang.start_in_flight_exit(spend_id)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)


def test_challenge_in_flight_exit_not_canonical_same_tx_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], force_invalid=True)

    testlang.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)


def test_challenge_in_flight_exit_not_canonical_unrelated_tx_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id_1 = testlang.deposit(owner_1, amount)
    deposit_id_2 = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id_1], [owner_1])
    unrelated_spend_id = testlang.spend_utxo([deposit_id_2], [owner_1])
    spend_tx = testlang.child_chain.get_transaction(spend_id)
    unrelated_spend_tx = testlang.child_chain.get_transaction(unrelated_spend_id)

    testlang.start_in_flight_exit(spend_id)

    proof = testlang.get_merkle_proof(unrelated_spend_id)
    signature = unrelated_spend_tx.signatures[0]

    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeInFlightExitNotCanonical(spend_tx.encoded, 0, unrelated_spend_tx.encoded, 0,
                                                              unrelated_spend_id, proof, signature,
                                                              **{'from': owner_2.address})


def test_challenge_in_flight_exit_not_canonical_wrong_index_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)
    spend_tx = testlang.child_chain.get_transaction(spend_id)
    double_spend_tx = testlang.child_chain.get_transaction(double_spend_id)

    testlang.start_in_flight_exit(spend_id)

    proof = testlang.get_merkle_proof(double_spend_id)
    signature = double_spend_tx.signatures[0]

    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeInFlightExitNotCanonical(spend_tx.encoded, 0, double_spend_tx.encoded, 1,
                                                              double_spend_id, proof, signature,
                                                              **{'from': owner_2.address})


def test_challenge_in_flight_exit_not_canonical_invalid_signature_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_2], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)

    testlang.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)


def test_challenge_in_flight_exit_not_canonical_invalid_proof_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)
    spend_tx = testlang.child_chain.get_transaction(spend_id)
    double_spend_tx = testlang.child_chain.get_transaction(double_spend_id)

    testlang.start_in_flight_exit(spend_id)

    proof = b''
    signature = double_spend_tx.signatures[0]

    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeInFlightExitNotCanonical(spend_tx.encoded, 0, double_spend_tx.encoded, 0,
                                                              double_spend_id, proof, signature,
                                                              **{'from': owner_2.address})


def test_challenge_in_flight_exit_not_canonical_same_tx_twice_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)

    testlang.start_in_flight_exit(spend_id)

    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)


def test_challenge_in_flight_exit_twice_older_position_should_succeed(testlang):
    owner_1, owner_2, owner_3, amount = testlang.accounts[0], testlang.accounts[1], testlang.accounts[2], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id_1 = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                            force_invalid=True)
    double_spend_id_2 = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 50)],
                                            force_invalid=True)

    testlang.start_in_flight_exit(spend_id)

    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id_2, account=owner_2)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id_1, account=owner_3)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.bond_owner == owner_3.address
    assert in_flight_exit.oldest_competitor == double_spend_id_1
    assert in_flight_exit.challenge_flag_set


def test_challenge_in_flight_exit_twice_younger_position_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id_1 = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                            force_invalid=True)
    double_spend_id_2 = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 50)],
                                            force_invalid=True)

    testlang.start_in_flight_exit(spend_id)

    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id_1, account=owner_2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id_2, account=owner_2)


def test_challenge_in_flight_exit_not_canonical_with_inputs_spent_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    testlang.start_standard_exit(deposit_id, owner_1)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)],
                                          force_invalid=True)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    testlang.start_in_flight_exit(spend_id)

    # Since IFE can be exited only from inputs, no further canonicity game required
    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)
