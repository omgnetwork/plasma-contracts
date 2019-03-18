import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS

def test_respond_to_non_canonical_challenge_should_succeed(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, key=owner_2.key)

    testlang.forward_to_period(2)

    testlang.respond_to_non_canonical_challenge(spend_id, owner_1.key)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.bond_owner == owner_1.address
    assert in_flight_exit.oldest_competitor == spend_id
    assert not in_flight_exit.challenge_flag_set


def test_respond_to_non_canonical_challenge_not_older_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key])
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, key=owner_2.key)

    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.respond_to_non_canonical_challenge(spend_id, owner_1.key)


def test_respond_to_non_canonical_challenge_invalid_proof_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, key=owner_2.key)

    testlang.forward_to_period(2)

    spend_tx = testlang.child_chain.get_transaction(spend_id)
    proof = b''
    with pytest.raises(TransactionFailed):
        testlang.root_chain.respondToNonCanonicalChallenge(spend_tx.encoded, spend_id, proof)
