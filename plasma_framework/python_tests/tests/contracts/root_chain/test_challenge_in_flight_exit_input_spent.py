import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from tests_utils.constants import PAYMENT_TX_MAX_INPUT_SIZE, PAYMENT_TX_MAX_OUTPUT_SIZE


# should succeed even when phase 2 of in-flight exit is over
@pytest.mark.parametrize("period", [0, 1, 2, 3])
def test_challenge_in_flight_exit_input_spent_should_succeed_for_all_periods(testlang, period):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner_1)
    testlang.forward_to_period(period)

    testlang.challenge_in_flight_exit_input_spent(spend_id, double_spend_id, owner_2)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.input_piggybacked(0)


@pytest.mark.parametrize(
    "double_spend_output_index,challenge_input_index",
    [(i, j) for i in range(PAYMENT_TX_MAX_OUTPUT_SIZE) for j in range(PAYMENT_TX_MAX_INPUT_SIZE)]
)
def test_challenge_in_flight_exit_input_spent_should_succeed_for_all_indices(
    testlang, double_spend_output_index, challenge_input_index
):
    alice, bob, carol = testlang.accounts[0], testlang.accounts[1], testlang.accounts[2]
    deposit_amount = 100
    deposit_id = testlang.deposit(alice, deposit_amount)

    tx_output_amount = deposit_amount // PAYMENT_TX_MAX_OUTPUT_SIZE
    outputs = [(alice.address, NULL_ADDRESS, tx_output_amount)] * PAYMENT_TX_MAX_OUTPUT_SIZE

    input_tx_id = testlang.spend_utxo([deposit_id], [alice], outputs=outputs)
    blknum, tx_index, _ = decode_utxo_id(input_tx_id)
    double_spend_utxo = encode_utxo_id(blknum, tx_index, double_spend_output_index)

    ife_output_amount = tx_output_amount
    ife_tx_id = testlang.spend_utxo(
        [double_spend_utxo],
        [alice],
        [(bob.address, NULL_ADDRESS, ife_output_amount)]
    )

    inputs = []
    for i in range(0, PAYMENT_TX_MAX_INPUT_SIZE):
        if i == challenge_input_index:
            inputs.append(double_spend_utxo)
        else:
            inputs.append(testlang.deposit(alice, tx_output_amount))

    challenge_tx_id = testlang.spend_utxo(
        inputs,
        [alice] * PAYMENT_TX_MAX_INPUT_SIZE,
        [
            (carol.address, NULL_ADDRESS, tx_output_amount),
        ],
        force_invalid=True
    )

    testlang.start_in_flight_exit(ife_tx_id, sender=bob)
    testlang.piggyback_in_flight_exit_input(ife_tx_id, 0, alice)
    testlang.challenge_in_flight_exit_input_spent(ife_tx_id, challenge_tx_id, carol)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
    for i in range(0, PAYMENT_TX_MAX_INPUT_SIZE):
        assert not in_flight_exit.input_piggybacked(i)


def test_challenge_in_flight_exit_input_spent_not_piggybacked_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_2.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_input_spent(spend_id, double_spend_id, owner_2)


def test_challenge_in_flight_exit_input_spent_same_tx_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner_1)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_input_spent(spend_id, spend_id, owner_2)


def test_challenge_in_flight_exit_input_spent_unrelated_tx_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id_1 = testlang.deposit(owner_1, amount)
    deposit_id_2 = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id_1], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    unrelated_spend_id = testlang.spend_utxo([deposit_id_2], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner_1)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_input_spent(spend_id, unrelated_spend_id, owner_2)


def test_challenge_in_flight_exit_input_spent_invalid_signature_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [(owner_1.address, NULL_ADDRESS, 100)])
    double_spend_id = testlang.spend_utxo([deposit_id], [owner_2], [(owner_2.address, NULL_ADDRESS, 100)], force_invalid=True)
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner_1)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.challenge_in_flight_exit_input_spent(spend_id, double_spend_id, owner_2)
