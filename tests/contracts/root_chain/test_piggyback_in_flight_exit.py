import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import MIN_EXIT_PERIOD, NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id


@pytest.mark.parametrize("num_inputs", [1, 2, 3, 4])
def test_piggyback_in_flight_exit_valid_input_owner_should_succeed(testlang, num_inputs):
    amount = 100
    owners = []
    deposit_ids = []
    for i in range(0, num_inputs):
        owners.append(testlang.accounts[i])
        deposit_ids.append(testlang.deposit(owners[i], amount))

    owner_keys = [owner.key for owner in owners]
    spend_id = testlang.spend_utxo(deposit_ids, owner_keys)

    testlang.start_in_flight_exit(spend_id)

    input_index = num_inputs - 1
    testlang.piggyback_in_flight_exit_input(spend_id, input_index, owners[input_index].key)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.input_piggybacked(input_index)


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_piggyback_in_flight_exit_valid_output_owner_should_succeed(testlang, num_outputs):
    owner_1, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner_1, amount)
    outputs = []
    for i in range(0, num_outputs):
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, 1))
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], outputs)

    testlang.start_in_flight_exit(spend_id)

    output_index = num_outputs - 1
    testlang.piggyback_in_flight_exit_output(spend_id, output_index, testlang.accounts[output_index].key)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.output_piggybacked(output_index)


def test_piggyback_in_flight_exit_invalid_owner_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key])

    testlang.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, 0, owner_2.key)


def test_piggyback_in_flight_exit_non_existent_exit_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, 0, owner.key)


def test_piggyback_unpiggybacked_output_of_finalized_in_flight_exit_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key],
                                   [(owner.address, NULL_ADDRESS, 50), (owner.address, NULL_ADDRESS, 50)])

    # First time should succeed
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner.key)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 100)

    # Piggybacking already finalized IFE should fail
    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_output(spend_id, 1, owner.key)


def test_piggyback_in_flight_exit_wrong_period_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    testlang.start_in_flight_exit(spend_id)
    testlang.forward_to_period(2)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, 0, owner.key)


def test_piggyback_in_flight_exit_invalid_index_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    testlang.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, 8, owner.key)


def test_piggyback_in_flight_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    testlang.start_in_flight_exit(spend_id)

    input_index = 0
    testlang.piggyback_in_flight_exit_input(spend_id, input_index, owner.key)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, input_index, owner.key)


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_piggyback_in_flight_exit_output_with_preexisting_standard_exit_should_fail(testlang, num_outputs):
    # exit cross-spend test, case 5
    owner_1, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner_1, amount)
    outputs = []
    for i in range(0, num_outputs):
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, 1))
    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], outputs)

    blknum, txindex, _ = decode_utxo_id(spend_id)
    exit_pos = encode_utxo_id(blknum, txindex, num_outputs - 1)
    testlang.start_standard_exit(exit_pos, key=testlang.accounts[num_outputs - 1].key)

    testlang.start_in_flight_exit(spend_id)

    assert testlang.get_standard_exit(exit_pos).amount == 1
    bond = testlang.root_chain.piggybackBond()

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_output(spend_id, num_outputs - 1, testlang.accounts[num_outputs - 1].key,
                                                 bond)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.output_piggybacked(num_outputs - 1)


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_piggyback_in_flight_exit_output_with_preexisting_finalized_standard_exit_should_fail(testlang, num_outputs):
    # exit cross-spend test, case 6
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    outputs = []
    for i in range(num_outputs):
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, 1))
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], outputs)

    blknum, txindex, _ = decode_utxo_id(spend_id)
    exit_pos = encode_utxo_id(blknum, txindex, num_outputs - 1)
    testlang.start_standard_exit(exit_pos, key=testlang.accounts[num_outputs - 1].key)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    testlang.start_in_flight_exit(spend_id)

    assert testlang.get_standard_exit(exit_pos).amount == 1
    bond = testlang.root_chain.piggybackBond()

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_output(spend_id, num_outputs - 1, testlang.accounts[num_outputs - 1].key,
                                                 bond)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.output_piggybacked(num_outputs - 1)


@pytest.mark.parametrize("output", [0, 4])
def test_piggybacking_an_output_of_unsupported_token_should_fail(testlang, token, output):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token.address, amount)])
    testlang.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, output, owner.key)


@pytest.mark.parametrize("output", [0, 4])  # first input and first output
def test_piggybacking_an_output_of_supported_token_should_succeed(testlang, token, output):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token.address, amount)])
    testlang.start_in_flight_exit(spend_id)

    testlang.root_chain.addToken(token.address)

    testlang.piggyback_in_flight_exit_input(spend_id, output, owner.key)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.input_piggybacked(output)


@pytest.mark.parametrize("outputs", [[0, 1], [4, 5], [0, 4], [0, 1, 4, 5]])  # inputs and outputs
def test_piggybacking_outputs_of_different_tokens_should_succeed(testlang, token, outputs):
    owner, amount = testlang.accounts[0], 100
    testlang.root_chain.addToken(token.address)
    token_deposit_id = testlang.deposit_token(owner, token, amount)
    eth_deposit_id = testlang.deposit(owner, amount)

    spend_id = testlang.spend_utxo([token_deposit_id, eth_deposit_id], [owner.key] * 2,
                                   [(owner.address, NULL_ADDRESS, amount), (owner.address, token.address, amount)])

    testlang.start_in_flight_exit(spend_id)

    for i in outputs:
        testlang.piggyback_in_flight_exit_input(spend_id, i, owner.key)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    for i in outputs:
        assert in_flight_exit.input_piggybacked(i)
