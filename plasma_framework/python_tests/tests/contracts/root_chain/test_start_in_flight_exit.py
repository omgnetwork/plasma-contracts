import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX

ETH_ADDRESS_HEX = NULL_ADDRESS_HEX


@pytest.mark.parametrize("num_inputs", [1, 2, 3, 4])
def test_start_in_flight_exit_should_succeed(testlang, num_inputs):
    amount = 100
    owners = []
    deposit_ids = []
    for i in range(0, num_inputs):
        owners.append(testlang.accounts[i])
        deposit_ids.append(testlang.deposit(owners[i], amount))

    spend_id = testlang.spend_utxo(deposit_ids, owners, outputs=[(owners[0].address, NULL_ADDRESS, amount)])

    testlang.start_in_flight_exit(spend_id)

    # Exit was created
    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == testlang.timestamp
    assert in_flight_exit.exit_map == 0
    assert in_flight_exit.bond_owner == owners[0].address
    assert in_flight_exit.oldest_competitor == 0

    # Inputs are correctly set
    for i in range(0, num_inputs):
        input_info = in_flight_exit.get_input(i)
        assert input_info.exit_target == owners[i].address
        assert input_info.token == ETH_ADDRESS_HEX
        assert input_info.amount == amount

    # Remaining inputs are still unset
    for i in range(num_inputs, 4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.exit_target == NULL_ADDRESS_HEX
        assert input_info.amount == 0


@pytest.mark.parametrize("num_inputs", [1, 2, 3, 4])
def test_start_in_flight_exit_with_erc20_tokens_should_succeed(testlang, token, num_inputs):
    amount = 100
    owners = []
    deposit_ids = []
    for i in range(0, num_inputs):
        owners.append(testlang.accounts[i])
        deposit_ids.append(testlang.deposit_token(owners[i], token, amount))

    spend_id = testlang.spend_utxo(deposit_ids, owners, outputs=[(owners[0].address, token.address, amount)])

    testlang.start_in_flight_exit(spend_id)

    # Exit was created
    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == testlang.timestamp
    assert in_flight_exit.exit_map == 0
    assert in_flight_exit.bond_owner == owners[0].address
    assert in_flight_exit.oldest_competitor == 0

    # Inputs are correctly set
    for i in range(0, num_inputs):
        input_info = in_flight_exit.get_input(i)
        assert input_info.exit_target == owners[i].address
        assert input_info.token == token.address
        assert input_info.amount == amount

    # Remaining inputs are still unset
    for i in range(num_inputs, 4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.exit_target == NULL_ADDRESS_HEX
        assert input_info.amount == 0


def test_start_in_flight_exit_with_erc20_token_and_eth_should_succeed(testlang, token):
    owner = testlang.accounts[0]
    deposit_eth_id = testlang.deposit(owner, 100)
    deposit_token_id = testlang.deposit_token(owner, token, 110)
    spend_id = testlang.spend_utxo(
        [deposit_eth_id, deposit_token_id],
        [owner, owner],
        [(owner.address, NULL_ADDRESS, 100), (owner.address, token.address, 110)]
    )

    testlang.start_in_flight_exit(spend_id)

    # Exit was created
    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == testlang.timestamp
    assert in_flight_exit.exit_map == 0
    assert in_flight_exit.bond_owner == owner.address
    assert in_flight_exit.oldest_competitor == 0

    # Inputs are correctly set
    input_info = in_flight_exit.get_input(0)
    assert input_info.exit_target == owner.address
    assert input_info.token == ETH_ADDRESS_HEX
    assert input_info.amount == 100

    input_info = in_flight_exit.get_input(1)
    assert input_info.exit_target == owner.address
    assert input_info.token == token.address
    assert input_info.amount == 110

    # Remaining inputs are still unset
    for i in range(2, 4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.exit_target == NULL_ADDRESS_HEX
        assert input_info.amount == 0


def test_start_in_flight_exit_with_an_output_with_a_token_not_from_inputs_should_fail(testlang, token):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, token.address, 100)])

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


@pytest.mark.parametrize(
    "output_values", [
        [401], [400, 1], [50, 50, 301], [100, 100, 100, 101]
    ]
)
def test_start_in_flight_exit_that_spends_more_than_value_of_inputs_should_fail(testlang, token, output_values):
    owner, amount = testlang.accounts[0], 100
    outputs = [(owner.address, token.address, value) for value in output_values]
    deposits = [testlang.deposit_token(owner, token, amount) for _ in range(4)]
    spend_id = testlang.spend_utxo(deposits, [owner] * 4, outputs, force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_invalid_signature_should_fail(testlang, token):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit_token(owner_1, token, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_2], outputs=[(owner_1.address, token.address, amount)], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_invalid_bond_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id, bond=0)


def test_start_in_flight_exit_invalid_spend_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner_2], outputs=[(owner_1.address, NULL_ADDRESS, amount)], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    proofs = [b'']
    (encoded_spend, encoded_inputs, input_pos, _, signatures) = testlang.get_in_flight_exit_info(spend_id)
    bond = testlang.root_chain.inFlightExitBond()

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startInFlightExit(encoded_spend, encoded_inputs, proofs, signatures, input_pos, value=bond)


def test_start_in_flight_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    # First time should succeed
    testlang.start_in_flight_exit(spend_id)

    # Second time should fail
    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_invalid_outputs_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)

    # Create a transaction with outputs greater than inputs
    output = (owner_2.address, NULL_ADDRESS, amount * 2)

    spend_id = testlang.spend_utxo([deposit_id], [owner_1], [output], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_spending_the_same_input_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id] * 2,
                                   [owner] * 2,
                                   [(owner.address, NULL_ADDRESS, amount)],
                                   force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.start_in_flight_exit(spend_id)


def test_start_in_flight_exit_with_four_different_tokens_should_succeed(testlang, get_contract):
    owner, amount, tokens_no = testlang.accounts[0], 100, 4

    tokens = [get_contract('ERC20Mintable') for _ in range(tokens_no)]
    deposits = [testlang.deposit_token(owner, tokens[i], amount) for i in range(tokens_no)]
    outputs = [(owner.address, tokens[i].address, amount) for i in range(4)]
    spend_id = testlang.spend_utxo(deposits, [owner] * tokens_no, outputs)

    testlang.start_in_flight_exit(spend_id, sender=owner)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    assert in_flight_exit.bond_owner == owner.address

# TODO: add test_start_in_flight_exit_with_holes_in_inputs_should_fail
