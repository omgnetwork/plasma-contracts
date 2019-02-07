import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD
from testlang.testlang import address_to_hex


@pytest.mark.parametrize("num_inputs", [1, 2, 3, 4])
def test_start_in_flight_exit_should_succeed(ethtester, testlang, num_inputs):
    amount = 100
    owners = []
    deposit_ids = []
    for i in range(0, num_inputs):
        owners.append(testlang.accounts[i])
        deposit_ids.append(testlang.deposit(owners[i], amount))

    owner_keys = [owner.key for owner in owners]
    spend_id = testlang.spend_utxo(deposit_ids, owner_keys)

    testlang.start_in_flight_exit(spend_id)

    # Exit was created
    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == ethtester.chain.head_state.timestamp
    assert in_flight_exit.exit_map == 0
    assert in_flight_exit.bond_owner == owners[0].address
    assert in_flight_exit.oldest_competitor == 0

    # Inputs are correctly set
    for i in range(0, num_inputs):
        input_info = in_flight_exit.get_input(i)
        assert input_info.owner == owners[i].address
        assert input_info.token == NULL_ADDRESS
        assert input_info.amount == amount

    # Remaining inputs are still unset
    for i in range(num_inputs, 4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.owner == address_to_hex(NULL_ADDRESS)
        assert input_info.amount == 0


# TODO: the two following cases could probably be done by parametrisation of the test above
# TODO: add test_start_in_flight_exit_with_ERC20_token_should_succeed
# TODO: add test_start_in_flight_exit_with_ERC20_tokens_should_succeed

# TODO: add test_start_in_flight_exit_with_holes_in_inputs_should_fail

# TODO: add test_start_in_flight_exit_with_output_with_a_token_not_from_inputs_should_fail

# TODO: add test_invalid_inputs_vs_outputs_sums_should_fail

# TODO: add test_start_in_flight_exit_invalid_signature_should_fail

# TODO: add test_all_outputs_should_have_the_same_priority


def test_start_in_flight_exit_invalid_bond_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id, bond=0)


def test_start_in_flight_exit_invalid_spend_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_2.key], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    proofs = b''
    (encoded_spend, encoded_inputs, _, signatures) = testlang.get_in_flight_exit_info(spend_id)
    bond = testlang.root_chain.inFlightExitBond()

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startInFlightExit(encoded_spend, encoded_inputs, proofs, signatures, value=bond)


def test_start_in_flight_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    # First time should succeed
    testlang.start_in_flight_exit(spend_id)

    # Second time should fail
    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_twice_different_piggybacks_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, NULL_ADDRESS, 50), (owner.address, NULL_ADDRESS, 50)])

    # First time should succeed
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner.key)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 10)

    # Second time should also succeed
    testlang.start_in_flight_exit(spend_id)

    # Exit was created
    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == testlang.ethtester.chain.head_state.timestamp
    assert in_flight_exit.exit_map == 2 ** 8
    assert in_flight_exit.bond_owner == owner.address
    assert in_flight_exit.oldest_competitor == 0


def test_start_in_flight_exit_invalid_outputs_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)

    # Create a transaction with outputs greater than inputs
    output = (owner_2.address, NULL_ADDRESS, amount * 2)

    spend_id = testlang.spend_utxo([deposit_id], [owner_1.key], [output], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_with_ERC20_tokens_should_fail(testlang, token):
    # this is a temporary limitation, will be fixed later
    owner, amount = testlang.accounts[0], 100
    deposit_eth_id = testlang.deposit(owner, amount)
    deposit_token_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo([deposit_eth_id, deposit_token_id], [owner.key, owner.key], [(owner.address, NULL_ADDRESS, 100), (owner.address, token.address, 50)])

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


@pytest.mark.parametrize("num_inputs", [1, 2, 3, 4])
def test_start_in_flight_exit_cancelling_standard_exits_from_inputs(testlang, num_inputs):
    # exit cross-spend test, case 1
    amount = 100
    owners = []
    deposit_ids = []
    for i in range(0, num_inputs):
        owners.append(testlang.accounts[i])
        deposit_id = testlang.deposit(owners[i], amount)
        deposit_ids.append(deposit_id)

    owner_keys = [owner.key for owner in owners]
    spend_id = testlang.spend_utxo(deposit_ids, owner_keys)

    for i in range(0, num_inputs):
        testlang.start_standard_exit(deposit_ids[i], owners[i].key)

    for i in range(0, num_inputs):
        assert testlang.get_standard_exit(deposit_ids[i]) == [owners[i].address, NULL_ADDRESS_HEX, 100]

    challenger = testlang.accounts[5]
    balance = testlang.get_balance(challenger)
    testlang.start_in_flight_exit(spend_id, sender=challenger)
    assert testlang.get_balance(challenger) == balance + num_inputs * testlang.root_chain.standardExitBond() - testlang.root_chain.inFlightExitBond()

    # Standard exits are correctly challenged
    for i in range(0, num_inputs):
        assert testlang.get_standard_exit(deposit_ids[i]) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]


@pytest.mark.parametrize("num_inputs", [1, 2, 3, 4])
def test_start_in_flight_exit_with_finalized_standard_exits_from_inputs_flags_exit(testlang, num_inputs):
    # exit cross-spend test, case 2
    amount = 100
    owners = []
    deposit_ids = []
    for i in range(0, num_inputs):
        owners.append(testlang.accounts[i])
        deposit_id = testlang.deposit(owners[i], amount)
        deposit_ids.append(deposit_id)

    owner_keys = [owner.key for owner in owners]
    spend_id = testlang.spend_utxo(deposit_ids, owner_keys)

    for i in range(0, num_inputs):
        testlang.start_standard_exit(deposit_ids[i], owners[i].key)

    for i in range(0, num_inputs):
        assert testlang.get_standard_exit(deposit_ids[i]) == [owners[i].address, NULL_ADDRESS_HEX, 100]

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 10)

    challenger = testlang.accounts[5]
    testlang.start_in_flight_exit(spend_id, sender=challenger)
    exit_id = testlang.get_in_flight_exit_id(spend_id)
    [ife_start_timestamp, _, _, _] = testlang.root_chain.inFlightExits(exit_id)

    # IFE is marked as SpentInput
    assert testlang.root_chain.flagged(ife_start_timestamp)
