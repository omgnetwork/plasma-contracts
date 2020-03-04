import pytest
from eth_utils import keccak
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id


# challenge should succeed even when phase 2 of in-flight exit is over
@pytest.mark.parametrize("period", [1, 2, 4])
def test_challenge_in_flight_exit_output_spent_should_succeed(testlang, period):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([spend_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.forward_to_period(period)

    testlang.challenge_in_flight_exit_output_spent(spend_id, double_spend_id, 0, owner_2)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.output_piggybacked(0)


@pytest.mark.parametrize(
    "ife_tx_num_outputs,double_spend_output_index,challenging_tx_num_inputs,double_spend_input_index",
    [(i, j, k, l) for i in range(1, 5) for j in range(0, i) for k in range(1, 5) for l in range(0, k)]
)
def test_challenge_in_flight_exit_output_spent_should_succeed_for_all_indices(testlang,
                                                                              ife_tx_num_outputs,
                                                                              double_spend_output_index,
                                                                              challenging_tx_num_inputs,
                                                                              double_spend_input_index):
    deposit_amount = 100
    deposit_id = testlang.deposit(testlang.accounts[0], deposit_amount)

    owners = []
    outputs = []
    tx_output_amount = deposit_amount // ife_tx_num_outputs
    for i in range(0, ife_tx_num_outputs):
        owners.append(testlang.accounts[i])
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, tx_output_amount))

    ife_tx_id = testlang.spend_utxo([deposit_id], owners, outputs=outputs)
    blknum, tx_index, _ = decode_utxo_id(ife_tx_id)
    double_spend_owner = owners[double_spend_output_index]
    double_spend_utxo = encode_utxo_id(blknum, tx_index, double_spend_output_index)

    testlang.start_in_flight_exit(ife_tx_id)
    testlang.piggyback_in_flight_exit_output(ife_tx_id, double_spend_output_index, double_spend_owner)

    MAX_INDEX_SIZE = 4
    inputs = []
    for i in range(0, MAX_INDEX_SIZE):
        if i == double_spend_input_index:
            inputs.append(double_spend_utxo)
        else:
            inputs.append(testlang.deposit(double_spend_owner, tx_output_amount))

    challenge_tx_id = testlang.spend_utxo(
        inputs,
        [double_spend_owner for i in range(0, MAX_INDEX_SIZE)],
        [
            (double_spend_owner.address, NULL_ADDRESS, tx_output_amount),
        ],
        force_invalid=True
    )

    testlang.challenge_in_flight_exit_output_spent(ife_tx_id, challenge_tx_id, double_spend_output_index, double_spend_owner)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
    for i in range(0, MAX_INDEX_SIZE):
        assert not in_flight_exit.output_piggybacked(i)


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
                                                             spending_tx_sig, keccak(hexstr=owner_2.address), **{'from': owner_2.address})
