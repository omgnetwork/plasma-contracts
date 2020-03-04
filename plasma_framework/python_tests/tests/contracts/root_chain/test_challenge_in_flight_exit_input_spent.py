import pytest
from eth_tester.exceptions import TransactionFailed

from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from tests_utils.constants import PAYMENT_TX_MAX_OUTPUT_SIZE


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


def _valid_input_combinations():
    return [(i, j) for i in range(1, PAYMENT_TX_MAX_OUTPUT_SIZE + 1) for j in range(i)]


@pytest.mark.parametrize("input_tx_combination", _valid_input_combinations())
@pytest.mark.parametrize("ife_combination", _valid_input_combinations())
@pytest.mark.parametrize("double_spend_combination", _valid_input_combinations())
def test_challenge_in_flight_exit_should_succeed_for_all_combinations_of_inputs_and_output_indexes(
        testlang,
        input_tx_combination,
        ife_combination,
        double_spend_combination):

    double_spender = testlang.accounts[-1]
    [alice, bob] = testlang.accounts[:2]

    input_tx_output_num, input_tx_output_spend_index = input_tx_combination
    ife_tx_input_num, ife_tx_input_double_spend_index = ife_combination
    double_spend_tx_input_num, double_spend_tx_double_spend_input_index = double_spend_combination

    input_tx_id = _create_transaction(
        testlang,
        dummy_inputs=1,
        dummy_outputs=input_tx_output_num - 1,
        outputs=[
            (input_tx_output_spend_index, (double_spender.address, NULL_ADDRESS, 1))
        ])

    blknum, tx_index, _ = decode_utxo_id(input_tx_id)
    double_spend_utxo = encode_utxo_id(blknum, tx_index, input_tx_output_spend_index)

    ife_tx_id = _create_transaction(
        testlang,
        dummy_inputs=ife_tx_input_num - 1,
        inputs=[(ife_tx_input_double_spend_index, double_spend_utxo, double_spender)],
        outputs=[(0, (alice.address, NULL_ADDRESS, 1))]
    )

    challenge_tx_id = _create_transaction(
        testlang,
        dummy_inputs=double_spend_tx_input_num - 1,
        inputs=[(double_spend_tx_double_spend_input_index, double_spend_utxo, double_spender)],
        outputs=[(0, (bob.address, NULL_ADDRESS, 1))],
        force_invalid=True
    )

    testlang.start_in_flight_exit(ife_tx_id)
    testlang.piggyback_in_flight_exit_input(ife_tx_id, ife_tx_input_double_spend_index, double_spender)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
    assert in_flight_exit.input_piggybacked(ife_tx_input_double_spend_index)

    testlang.forward_to_period(1)
    testlang.challenge_in_flight_exit_input_spent(ife_tx_id, challenge_tx_id, double_spender)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
    assert not in_flight_exit.input_piggybacked(ife_tx_input_double_spend_index)


def _create_transaction(testlang, inputs=None, outputs=None, dummy_inputs=0, dummy_outputs=0, force_invalid=False):
    if not inputs:
        inputs = []
    if not outputs:
        outputs = []

    inputs_owners = []
    tx_inputs = []
    deposit_amount = 100
    for i in range(dummy_inputs):
        owner = testlang.accounts[i]
        deposit = testlang.deposit(owner, deposit_amount)
        tx_inputs.append(deposit)
        inputs_owners.append(owner)

    tx_outputs = []
    for i in range(dummy_outputs):
        owner = testlang.accounts[i]
        output = (owner.address, NULL_ADDRESS, 1)
        tx_outputs.append(output)

    for (pos, utxo, owner) in inputs:
        tx_inputs.insert(pos, utxo)
        inputs_owners.insert(pos, owner)

    for (pos, output) in outputs:
        tx_outputs.insert(pos, output)

    return testlang.spend_utxo(tx_inputs, inputs_owners, tx_outputs, force_invalid=force_invalid)
