import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id


# should succeed even when phase 2 of in-flight exit is over
@pytest.mark.parametrize("period", [1, 2, 3])
def test_challenge_in_flight_exit_input_spent_should_succeed_after_first_period_passes(testlang, period):
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


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_challenge_in_flight_exit_should_succeed_for_all_output_indexes(testlang, num_outputs):
    deposit_amount = 100
    deposit_id = testlang.deposit(testlang.accounts[0], deposit_amount)

    owners = []
    outputs = []
    tx_output_amount = deposit_amount // num_outputs
    for i in range(0, num_outputs):
        owners.append(testlang.accounts[i])
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, tx_output_amount))

    input_tx_id = testlang.spend_utxo([deposit_id], owners, outputs=outputs)

    blknum, tx_index, _ = decode_utxo_id(input_tx_id)
    double_spend_output_index = num_outputs - 1
    double_spend_owner = owners[double_spend_output_index]
    double_spend_utxo = encode_utxo_id(blknum, tx_index, double_spend_output_index)

    ife_output_amount = tx_output_amount // 2
    ife_tx_id = testlang.spend_utxo(
        [double_spend_utxo],
        [double_spend_owner],
        [(owners[0].address, NULL_ADDRESS, ife_output_amount)]
    )

    challenge_tx_id = testlang.spend_utxo(
        [double_spend_utxo],
        [double_spend_owner],
        [
            (owners[0].address, NULL_ADDRESS, ife_output_amount),
            (owners[0].address, NULL_ADDRESS, ife_output_amount)
        ],
        force_invalid=True
    )

    testlang.start_in_flight_exit(ife_tx_id)
    testlang.piggyback_in_flight_exit_input(ife_tx_id, 0, double_spend_owner)
    testlang.forward_to_period(1)
    testlang.challenge_in_flight_exit_input_spent(ife_tx_id, challenge_tx_id, double_spend_owner)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
    assert not in_flight_exit.input_piggybacked(double_spend_output_index)


@pytest.mark.parametrize("challenge_index", [0, 1, 2, 3])
def test_challenge_in_flight_exit_should_succeed_for_all_challenge_indexes(testlang, challenge_index):
    MAX_INDEX_SIZE = 4
    alice, bob, carol = testlang.accounts[0], testlang.accounts[1], testlang.accounts[2]
    amount = 100

    deposit_id = testlang.deposit(alice, amount)

    input_tx_id = testlang.spend_utxo(
        [deposit_id],
        [testlang.accounts[0]],
        outputs=[(alice.address, NULL_ADDRESS, amount)]
    )

    ife_tx_id = testlang.spend_utxo(
        [input_tx_id],
        [alice],
        [(bob.address, NULL_ADDRESS, amount)]
    )

    inputs = []
    for i in range(0, MAX_INDEX_SIZE):
        if i == challenge_index:
            inputs.append(input_tx_id)
        else:
            inputs.append(testlang.deposit(alice, amount))

    challenge_tx_id = testlang.spend_utxo(
        inputs,
        [alice for i in range(0, MAX_INDEX_SIZE)],
        [
            (carol.address, NULL_ADDRESS, amount),
        ],
        force_invalid=True
    )

    testlang.start_in_flight_exit(ife_tx_id)
    testlang.piggyback_in_flight_exit_input(ife_tx_id, 0, alice)
    testlang.forward_to_period(1)
    testlang.challenge_in_flight_exit_input_spent(ife_tx_id, challenge_tx_id, carol)

    in_flight_exit = testlang.get_in_flight_exit(ife_tx_id)
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
