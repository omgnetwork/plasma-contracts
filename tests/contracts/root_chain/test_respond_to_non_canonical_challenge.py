import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, MIN_EXIT_PERIOD


# should succeed even when phase 2 of in-flight exit is over
@pytest.mark.parametrize("period", [1, 2, 4])
def test_respond_to_non_canonical_challenge_should_succeed(testlang, period):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    testlang.forward_to_period(period)

    testlang.respond_to_non_canonical_challenge(spend_id, owner_1)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.bond_owner == owner_1.address
    assert in_flight_exit.oldest_competitor == spend_id
    assert not in_flight_exit.challenge_flag_set


def test_respond_to_non_canonical_challenge_not_older_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.respond_to_non_canonical_challenge(spend_id, owner_1)


def test_respond_to_non_canonical_challenge_invalid_proof_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    testlang.forward_to_period(2)

    spend_tx = testlang.child_chain.get_transaction(spend_id)
    proof = b''
    with pytest.raises(TransactionFailed):
        testlang.root_chain.respondToNonCanonicalChallenge(spend_tx.encoded, spend_id, proof)


def test_respond_to_not_canonical_challenge_with_inputs_spent_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    testlang.start_standard_exit(deposit_id, owner_1)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    testlang.start_in_flight_exit(spend_id)

    testlang.forward_to_period(2)

    # Since IFE can be exited only from inputs, no further canonicity game required
    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)
