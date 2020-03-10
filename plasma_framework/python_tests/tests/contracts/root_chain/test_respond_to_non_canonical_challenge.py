import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, MIN_EXIT_PERIOD
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from tests_utils.constants import PAYMENT_TX_MAX_INPUT_SIZE, PAYMENT_TX_MAX_OUTPUT_SIZE


# should succeed even when phase 2 of in-flight exit is over
@pytest.mark.parametrize("period", [1, 2, 4])
def test_respond_to_non_canonical_challenge_should_succeed(testlang, period):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    testlang.forward_to_period(period)

    testlang.respond_to_non_canonical_challenge(spend_id, owner_1)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.bond_owner == owner_1.address
    assert in_flight_exit.oldest_competitor == spend_id
    assert in_flight_exit.is_canonical


def _output_params():
    return [(i, j) for i in range(1, PAYMENT_TX_MAX_OUTPUT_SIZE + 1) for j in range(i)]

def _input_params():
    return [(i, j) for i in range(1, PAYMENT_TX_MAX_INPUT_SIZE + 1) for j in range(i)]


@pytest.mark.parametrize(
    "input_tx_output_num, double_spend_output_index", _output_params()
)
@pytest.mark.parametrize(
    "ife_tx_input_num, ife_input_index", _input_params()
)
@pytest.mark.parametrize(
    "challenge_tx_input_num, challenge_input_index", _input_params()
)
def test_challenge_in_flight_exit_not_canonical_should_succeed_for_all_indices(
    testlang,
    input_tx_output_num,
    double_spend_output_index,
    ife_tx_input_num,
    ife_input_index,
    challenge_tx_input_num,
    challenge_input_index
):
    alice, bob, carol = testlang.accounts[0], testlang.accounts[1], testlang.accounts[2]
    deposit_amount = 100
    deposit_id = testlang.deposit(alice, deposit_amount)

    tx_output_amount = deposit_amount // PAYMENT_TX_MAX_OUTPUT_SIZE
    outputs = [(alice.address, NULL_ADDRESS, tx_output_amount)] * input_tx_output_num

    input_tx_id = testlang.spend_utxo([deposit_id], [alice], outputs=outputs)
    blknum, tx_index, _ = decode_utxo_id(input_tx_id)
    double_spend_utxo = encode_utxo_id(blknum, tx_index, double_spend_output_index)

    ife_tx_inputs = []
    for i in range(ife_tx_input_num):
        if i == ife_input_index:
            ife_tx_inputs.append(double_spend_utxo)
        else:
            ife_tx_inputs.append(testlang.deposit(alice, tx_output_amount))

    ife_output_amount = tx_output_amount
    ife_tx_id = testlang.spend_utxo(
        ife_tx_inputs,
        [alice] * PAYMENT_TX_MAX_INPUT_SIZE,
        [(bob.address, NULL_ADDRESS, ife_output_amount)]
    )

    challenge_tx_inputs = []
    for i in range(challenge_tx_input_num):
        if i == challenge_input_index:
            challenge_tx_inputs.append(double_spend_utxo)
        else:
            challenge_tx_inputs.append(testlang.deposit(alice, tx_output_amount))

    challenge_tx_id = testlang.spend_utxo(
        challenge_tx_inputs,
        [alice] * PAYMENT_TX_MAX_INPUT_SIZE,
        [
            (carol.address, NULL_ADDRESS, tx_output_amount),
        ],
        force_invalid=True
    )

    testlang.start_in_flight_exit(ife_tx_id)

    testlang.challenge_in_flight_exit_not_canonical(ife_tx_id, challenge_tx_id, account=carol)

    testlang.forward_to_period(1)

    testlang.respond_to_non_canonical_challenge(ife_tx_id, alice)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
    assert in_flight_exit.bond_owner == alice.address
    assert in_flight_exit.oldest_competitor == ife_tx_id
    assert in_flight_exit.is_canonical


def test_respond_to_non_canonical_challenge_not_older_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)], force_invalid=True)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    testlang.start_in_flight_exit(spend_id)
    testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)

    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.respond_to_non_canonical_challenge(spend_id, owner_1)


def test_respond_to_non_canonical_challenge_invalid_proof_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)])
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
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)], force_invalid=True)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    testlang.start_in_flight_exit(spend_id)

    testlang.forward_to_period(2)

    # Since IFE can be exited only from inputs, no further canonicity game required
    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_not_canonical(spend_id, double_spend_id, account=owner_2)
