import pytest
from eth_tester.exceptions import TransactionFailed
from eth_utils import to_canonical_address

from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from tests.conftest import assert_event


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_process_exits_standard_exit_should_succeed(testlang, num_outputs):
    owners, amount, outputs = [], 100, []
    for i in range(0, num_outputs):
        owners.append(testlang.accounts[i + 1])
        outputs.append((owners[i].address, NULL_ADDRESS, amount))

    deposit_id = testlang.deposit(owners[0], num_outputs * amount)
    spend_id = testlang.spend_utxo([deposit_id], [owners[0]], outputs)

    output_index = num_outputs - 1
    utxo_pos = spend_id + output_index
    output_owner = owners[output_index]

    pre_balance = testlang.get_balance(output_owner)
    testlang.flush_events()

    testlang.start_standard_exit(utxo_pos, output_owner)
    [exit_event] = testlang.flush_events()
    assert_event(exit_event, event_name='ExitStarted', event_args={"owner": output_owner.address})

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    [exit_finalized] = testlang.flush_events()
    assert_event(exit_finalized, event_name='ExitFinalized', event_args={"exitId": exit_event['args']['exitId']})

    standard_exit = testlang.get_standard_exit(utxo_pos)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.token == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount
    assert testlang.get_balance(output_owner) == pre_balance + amount


def test_process_exits_in_flight_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, 100)])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    pre_balance = testlang.get_balance(owner)
    testlang.process_exits(NULL_ADDRESS, 0, 100)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == 0
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.oldest_competitor == 0

    for i in range(4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.owner == NULL_ADDRESS
        assert input_info.amount == 0

        output_info = in_flight_exit.get_output(i)
        assert output_info.owner == NULL_ADDRESS
        assert output_info.amount == 0

    expected_balance = pre_balance + amount + testlang.root_chain.inFlightExitBond() + testlang.root_chain.piggybackBond()
    assert testlang.get_balance(owner) == expected_balance


def test_finalize_exits_for_erc20_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, token.address, amount)])

    testlang.start_standard_exit(spend_id, owner)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.amount == amount
    assert standard_exit.token == token.address
    assert standard_exit.owner == owner.address
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    pre_balance = token.balanceOf(owner.address)
    testlang.process_exits(token.address, 0, 100)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.amount == amount
    assert standard_exit.token == NULL_ADDRESS_HEX
    assert standard_exit.owner == NULL_ADDRESS_HEX
    assert token.balanceOf(owner.address) == pre_balance + amount


def test_finalize_exits_old_utxo_is_mature_after_single_mfp(testlang):
    minimal_finalization_period = MIN_EXIT_PERIOD  # aka MFP - see tesuji blockchain design
    required_exit_period = MIN_EXIT_PERIOD  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, amount)])

    testlang.forward_timestamp(required_exit_period)
    testlang.start_standard_exit(spend_id, owner)
    testlang.forward_timestamp(minimal_finalization_period)

    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)

    testlang.forward_timestamp(1)
    assert testlang.get_standard_exit(spend_id).owner == owner.address

    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id).owner == NULL_ADDRESS_HEX


def test_finalize_exits_new_utxo_is_mature_after_mfp_plus_rep(testlang):
    minimal_finalization_period = MIN_EXIT_PERIOD  # aka MFP - see tesuji blockchain design
    required_exit_period = MIN_EXIT_PERIOD  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner)

    testlang.forward_timestamp(required_exit_period)
    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id).owner == owner.address

    testlang.forward_timestamp(minimal_finalization_period + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id).owner == NULL_ADDRESS_HEX


def test_finalize_exits_only_mature_exits_are_processed(testlang):
    minimal_finalization_period = MIN_EXIT_PERIOD  # aka MFP - see tesuji blockchain design
    required_exit_period = MIN_EXIT_PERIOD  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo([deposit_id_1], [owner], [(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id_1, owner)

    testlang.forward_timestamp(required_exit_period + minimal_finalization_period + 1)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id_2 = testlang.spend_utxo([deposit_id_2], [owner], [(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id_2, owner)

    assert testlang.get_standard_exit(spend_id_1).owner == owner.address
    assert testlang.get_standard_exit(spend_id_2).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id_1).owner == NULL_ADDRESS_HEX
    assert testlang.get_standard_exit(spend_id_2).owner == owner.address


def test_finalize_exits_for_uninitialized_erc20_should_fail(testlang, root_chain, token):
    assert not root_chain.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        testlang.process_exits(token.address, 0, 100)


def test_finalize_exits_partial_queue_processing(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo([deposit_id_1], [owner], [(owner.address, NULL_ADDRESS, amount)])
    testlang.start_standard_exit(spend_id_1, owner)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id_2 = testlang.spend_utxo([deposit_id_2], [owner], [(owner.address, NULL_ADDRESS, amount)])
    testlang.start_standard_exit(spend_id_2, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(spend_id_1), 1)
    plasma_exit = testlang.get_standard_exit(spend_id_1)
    assert plasma_exit.owner == NULL_ADDRESS_HEX
    plasma_exit = testlang.get_standard_exit(spend_id_2)
    assert plasma_exit.owner == owner.address


def test_processing_exits_with_specifying_top_exit_id_is_possible(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    testlang.start_standard_exit(deposit_id_1, owner)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id_2 = testlang.spend_utxo([deposit_id_2], [owner], [(owner.address, NULL_ADDRESS, amount)])
    testlang.start_in_flight_exit(spend_id_2)
    testlang.piggyback_in_flight_exit_output(spend_id_2, 0, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(deposit_id_1), 1)
    testlang.process_exits(NULL_ADDRESS, testlang.get_in_flight_exit_id(spend_id_2), 1)

    in_flight_exit = testlang.get_in_flight_exit(spend_id_2)
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX


def test_finalize_exits_tx_race_short_circuit(testlang, w3, root_chain):
    utxo1 = testlang.create_utxo()
    utxo2 = testlang.create_utxo()
    utxo3 = testlang.create_utxo()
    utxo4 = testlang.create_utxo()
    testlang.start_standard_exit(utxo1.spend_id, utxo1.owner)
    testlang.start_standard_exit(utxo2.spend_id, utxo2.owner)
    testlang.start_standard_exit(utxo3.spend_id, utxo3.owner)
    testlang.start_standard_exit(utxo4.spend_id, utxo4.owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(utxo1.spend_id), 1)

    tx_hash = root_chain.functions\
        .processExits(NULL_ADDRESS, testlang.get_standard_exit_id(utxo1.spend_id), 3)\
        .transact({'gas': 100_000})  # reasonably high amount of gas (otherwise it fails on gas estimation)

    tx_receipt = w3.eth.getTransactionReceipt(tx_hash)
    short_circuit_gas = tx_receipt['gasUsed']

    assert tx_receipt['status'] == 0  # assert the tx failed
    assert short_circuit_gas < 69408  # value from _tx_race_normal


def test_finalize_exits_tx_race_normal(testlang, w3):
    utxo1 = testlang.create_utxo()
    utxo2 = testlang.create_utxo()
    utxo3 = testlang.create_utxo()
    utxo4 = testlang.create_utxo()
    testlang.start_standard_exit(utxo1.spend_id, utxo1.owner)
    testlang.start_standard_exit(utxo2.spend_id, utxo2.owner)
    testlang.start_standard_exit(utxo3.spend_id, utxo3.owner)
    testlang.start_standard_exit(utxo4.spend_id, utxo4.owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(utxo1.spend_id), 1)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    tx_hash = testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(utxo2.spend_id), 3)
    tx_receipt = w3.eth.getTransactionReceipt(tx_hash)
    three_exits_tx_gas = tx_receipt['gasUsed']
    assert three_exits_tx_gas > 26258  # value from _tx_race_short_circuit


def test_finalize_exits_empty_queue_should_crash(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo([deposit_id_1], [owner], [(owner.address, NULL_ADDRESS, 100)])
    testlang.start_standard_exit(spend_id_1, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(spend_id_1), 1)

    with pytest.raises(TransactionFailed):
        testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(spend_id_1), 1)
    with pytest.raises(TransactionFailed):
        testlang.process_exits(NULL_ADDRESS, 0, 1)


def test_finalize_skipping_top_utxo_check_is_possible(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo([deposit_id_1], [owner], [(owner.address, NULL_ADDRESS, 100)])
    testlang.start_standard_exit(spend_id_1, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    standard_exit = testlang.get_standard_exit(spend_id_1)
    assert standard_exit.owner == NULL_ADDRESS_HEX


def test_finalize_challenged_exit_will_not_send_funds(testlang):
    owner, finalizer, amount = testlang.accounts[0], testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, 100)])

    testlang.start_standard_exit(spend_id, owner)
    doublespend_id = testlang.spend_utxo([spend_id], [owner], [(owner.address, NULL_ADDRESS, 100)])

    testlang.challenge_standard_exit(spend_id, doublespend_id)
    assert testlang.get_standard_exit(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    pre_balance = testlang.get_balance(testlang.root_chain)
    testlang.process_exits(NULL_ADDRESS, 0, 1, **{'from': finalizer.address})
    post_balance = testlang.get_balance(testlang.root_chain)
    assert post_balance == pre_balance


def test_finalize_challenged_exit_does_not_emit_events(testlang):
    owner, finalizer, amount = testlang.accounts[0], testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, 100)])

    testlang.start_standard_exit(spend_id, owner)
    doublespend_id = testlang.spend_utxo([spend_id], [owner], [(owner.address, NULL_ADDRESS, 100)])

    testlang.challenge_standard_exit(spend_id, doublespend_id)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    testlang.flush_events()
    testlang.process_exits(NULL_ADDRESS, 0, 1, **{'from': finalizer.address})
    assert [] == testlang.flush_events()


def test_finalize_exit_challenge_of_finalized_will_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(spend_id), 100)
    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    doublespend_id = testlang.spend_utxo([spend_id], [owner], [(owner.address, NULL_ADDRESS, 100)])
    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(spend_id, doublespend_id)


def test_finalize_exits_for_in_flight_exit_should_transfer_funds(testlang):
    owner, amount = testlang.accounts[0], 100
    first_utxo = 100 - 33
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner],
                                   [(owner.address, NULL_ADDRESS, first_utxo), (owner.address, NULL_ADDRESS, 33)])

    # start an in-flight exit and piggyback it
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    exitable_timestamp, _, _ = testlang.root_chain.getNextExit(NULL_ADDRESS)
    pre_balance = testlang.get_balance(owner)

    testlang.process_exits(NULL_ADDRESS, 0, 10)
    assert testlang.get_balance(
        owner) == pre_balance + first_utxo + testlang.root_chain.inFlightExitBond() + testlang.root_chain.piggybackBond()


def test_finalize_in_flight_exit_finalizes_only_piggybacked_outputs(testlang):
    owner, amount = testlang.accounts[0], 100
    first_utxo = 100 - 33
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner],
                                   [(owner.address, NULL_ADDRESS, first_utxo), (owner.address, NULL_ADDRESS, 33)])

    # start an in-flight exit and piggyback it
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    exitable_timestamp, _, _ = testlang.root_chain.getNextExit(NULL_ADDRESS)
    pre_balance = testlang.get_balance(owner)

    testlang.process_exits(NULL_ADDRESS, 0, 10)
    assert testlang.get_balance(
        owner) == pre_balance + first_utxo + testlang.root_chain.inFlightExitBond() + testlang.root_chain.piggybackBond()

    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    assert in_flight_exit.output_blocked(0)
    assert not in_flight_exit.output_blocked(1)


def test_finalize_exits_priority_for_in_flight_exits_corresponds_to_the_age_of_youngest_input(testlang, tester):
    owner, amount = testlang.accounts[0], 100
    deposit_0_id = testlang.deposit(owner, amount)
    deposit_1_id = testlang.deposit(owner, amount)

    spend_00_id = testlang.spend_utxo([deposit_0_id], [owner],
                                      [(owner.address, NULL_ADDRESS, 30), (owner.address, NULL_ADDRESS, 70)])
    blknum, txindex, _ = decode_utxo_id(spend_00_id)
    spend_01_id = encode_utxo_id(blknum, txindex, 1)
    spend_1_id = testlang.spend_utxo([spend_01_id], [owner], [(owner.address, NULL_ADDRESS, 70)])
    spend_2_id = testlang.spend_utxo([deposit_1_id], [owner], [(owner.address, NULL_ADDRESS, 100)])

    testlang.start_standard_exit(spend_00_id, owner)

    testlang.start_in_flight_exit(spend_1_id)
    testlang.piggyback_in_flight_exit_output(spend_1_id, 0, owner)
    testlang.start_standard_exit(spend_2_id, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    balance = testlang.get_balance(owner)

    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(spend_00_id), 1)
    assert testlang.get_balance(owner) == balance + 30 + testlang.root_chain.standardExitBond()

    balance = testlang.get_balance(owner)
    testlang.process_exits(NULL_ADDRESS, testlang.get_in_flight_exit_id(spend_1_id), 1)
    assert testlang.get_balance(
        owner) == balance + 70 + testlang.root_chain.inFlightExitBond() + testlang.root_chain.piggybackBond()

    balance = testlang.get_balance(owner)
    testlang.process_exits(NULL_ADDRESS, testlang.get_standard_exit_id(spend_2_id), 1)
    assert testlang.get_balance(owner) == balance + 100 + testlang.root_chain.standardExitBond()


def test_finalize_in_flight_exit_with_erc20_token_should_succeed(testlang, token):
    owner, amount = testlang.accounts[1], 100
    testlang.root_chain.addToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, token.address, amount)])

    testlang.start_in_flight_exit(spend_id)

    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    testlang.process_exits(token.address, 0, 1, gas=200_000)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    assert in_flight_exit.exit_start_timestamp == 0
    assert in_flight_exit.exit_priority == 0
    for i in range(4):
        tx_input = in_flight_exit.get_input(i)
        assert tx_input.amount == 0
        assert tx_input.owner == NULL_ADDRESS

        tx_output = in_flight_exit.get_input(i)
        assert tx_output.amount == 0
        assert tx_output.owner == NULL_ADDRESS

    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.oldest_competitor == 0

    assert in_flight_exit.input_blocked(0)
    assert in_flight_exit.output_blocked(0)


def test_finalize_in_flight_exit_with_erc20_token_should_transfer_funds_and_bond(testlang, token):
    owner, amount = testlang.accounts[1], 100
    testlang.root_chain.addToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, token.address, amount)])

    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    token_balance = testlang.get_balance(owner, token)
    eth_balance = testlang.get_balance(owner)

    testlang.process_exits(token.address, 0, 1, gas=800_000)

    assert testlang.get_balance(owner, token) == token_balance + amount
    assert testlang.get_balance(owner) == eth_balance + testlang.root_chain.piggybackBond()


def test_finalize_in_flight_exit_with_eth_and_erc20_token(testlang, token):
    (owner_1, owner_2), amount = testlang.accounts[1:3], 100
    testlang.root_chain.addToken(token.address)
    token_deposit = testlang.deposit_token(owner_1, token, amount)
    eth_deposit = testlang.deposit(owner_2, amount)

    spend_id = testlang.spend_utxo([token_deposit, eth_deposit], [owner_1, owner_2],
                                   [(owner_1.address, NULL_ADDRESS, amount - 1),
                                    (owner_2.address, token.address, amount - 2)])

    testlang.start_in_flight_exit(spend_id)

    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.piggyback_in_flight_exit_output(spend_id, 1, owner_2)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    (owner_1_balances, owner_2_balances) = [
        (testlang.get_balance(owner), testlang.get_balance(owner, token)) for owner in [owner_1, owner_2]
    ]

    # finalize only ERC20 token
    testlang.process_exits(token.address, 0, 1)

    assert testlang.get_balance(owner_1) == owner_1_balances[0]
    assert testlang.get_balance(owner_1, token) == owner_1_balances[1]

    # only owner 2 receives his founds
    assert testlang.get_balance(owner_2) == owner_2_balances[0] + testlang.root_chain.piggybackBond()
    assert testlang.get_balance(owner_2, token) == owner_2_balances[1] + (amount - 2)

    # finalize Eth
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    assert testlang.get_balance(owner_1) == owner_1_balances[0] + (amount - 1) + testlang.root_chain.piggybackBond()
    assert testlang.get_balance(owner_1, token) == owner_1_balances[1]

    # nothing changed
    assert testlang.get_balance(owner_2) == owner_2_balances[0] + testlang.root_chain.piggybackBond()
    assert testlang.get_balance(owner_2, token) == owner_2_balances[1] + (amount - 2)


def test_does_not_finalize_outputs_of_other_tokens(testlang, token):
    (owner_1, owner_2), amount = testlang.accounts[1:3], 100
    testlang.root_chain.addToken(token.address)
    token_deposit = testlang.deposit_token(owner_1, token, amount)
    eth_deposit = testlang.deposit(owner_2, amount)

    spend_id = testlang.spend_utxo([token_deposit, eth_deposit], [owner_1, owner_2],
                                   outputs=[(owner_1.address, NULL_ADDRESS, amount - 1),
                                            (owner_2.address, token.address, amount - 22),
                                            (owner_2.address, token.address, 20)
                                            ])

    testlang.start_in_flight_exit(spend_id)

    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.piggyback_in_flight_exit_output(spend_id, 1, owner_2)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    (owner_1_balances, owner_2_balances) = [
        (testlang.get_balance(owner), testlang.get_balance(owner, token.address)) for owner in [owner_1, owner_2]
    ]

    # finalize Eth
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    assert testlang.get_balance(owner_1) == owner_1_balances[0] + (amount - 1) + testlang.root_chain.piggybackBond()
    assert testlang.get_balance(owner_1, token.address) == owner_1_balances[1]

    assert testlang.get_balance(owner_2) == owner_2_balances[0]
    assert testlang.get_balance(owner_2, token.address) == owner_2_balances[1]


def test_when_processing_ife_finalization_of_erc20_token_does_not_clean_up_eth_outputs_data(testlang, token):
    (owner_1, owner_2), amount = testlang.accounts[1:3], 100
    testlang.root_chain.addToken(token.address)
    token_deposit = testlang.deposit_token(owner_1, token, amount)
    eth_deposit = testlang.deposit(owner_2, amount)

    spend_id = testlang.spend_utxo([token_deposit, eth_deposit], [owner_1, owner_2],
                                   [(owner_1.address, NULL_ADDRESS, amount),
                                    (owner_2.address, token.address, amount)])

    testlang.start_in_flight_exit(spend_id)

    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.piggyback_in_flight_exit_output(spend_id, 1, owner_2)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    # finalize only ERC20 token
    testlang.process_exits(token.address, 0, 1)
    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    assert not in_flight_exit.output_blocked(0)
    assert in_flight_exit.output_blocked(1)

    assert in_flight_exit.output_piggybacked(0)
    assert not in_flight_exit.output_piggybacked(1)

    assert in_flight_exit.get_output(0).owner == to_canonical_address(owner_1.address)
    assert in_flight_exit.get_output(0).amount == amount


def test_ife_is_enqueued_once_per_token(testlang, token):
    owner, amount = testlang.accounts[0], 100
    eth_deposit_id = testlang.deposit(owner, amount)
    token_deposit_id = testlang.deposit_token(owner, token, amount)
    testlang.root_chain.addToken(token.address)

    spend_id = testlang.spend_utxo([token_deposit_id, eth_deposit_id], [owner] * 2,
                                   [(owner.address, NULL_ADDRESS, amount // 2),
                                    (owner.address, NULL_ADDRESS, amount // 2),
                                    (owner.address, token.address, amount // 2),
                                    (owner.address, token.address, amount // 2)])

    testlang.start_in_flight_exit(spend_id)
    for i in range(4):
        testlang.piggyback_in_flight_exit_output(spend_id, i, owner)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    # check Eth
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    with pytest.raises(TransactionFailed):
        testlang.process_exits(NULL_ADDRESS, 0, 1)

    # check ERC20 token
    testlang.process_exits(token.address, 0, 1)

    with pytest.raises(TransactionFailed):
        testlang.process_exits(token.address, 0, 1)


def test_when_processing_an_ife_it_is_cleaned_up_when_all_piggybacked_outputs_finalized(testlang, token):
    (owner_1, owner_2), amount = testlang.accounts[1:3], 100
    testlang.root_chain.addToken(token.address)
    token_deposit = testlang.deposit_token(owner_1, token, amount)
    eth_deposit = testlang.deposit(owner_2, amount)

    spend_id = testlang.spend_utxo([token_deposit, eth_deposit], [owner_1, owner_2],
                                   [(owner_1.address, NULL_ADDRESS, amount),
                                    (owner_2.address, token.address, amount)])

    testlang.start_in_flight_exit(spend_id)

    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner_1)
    testlang.piggyback_in_flight_exit_output(spend_id, 1, owner_2)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    # finalize both ERC20 token and Eth outputs
    testlang.process_exits(token.address, 0, 1)

    pre_balance = testlang.get_balance(testlang.accounts[0])

    testlang.process_exits(NULL_ADDRESS, 0, 1)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    # most of the fields are deleted
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.exit_priority == 0
    assert in_flight_exit.oldest_competitor == 0
    assert in_flight_exit.exit_start_timestamp == 0

    # some fields are not deleted
    assert in_flight_exit.exit_map != 0

    # assert bond was sent to the owner
    assert testlang.get_balance(testlang.accounts[0]) == pre_balance + testlang.root_chain.inFlightExitBond()


def test_in_flight_exit_is_cleaned_up_even_though_none_of_outputs_exited(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, amount)])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    pre_balance = testlang.get_balance(owner)

    testlang.process_exits(NULL_ADDRESS, 0, 1)

    in_flight_exit = testlang.get_in_flight_exit(spend_id)

    # most of the fields are deleted
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.exit_priority == 0
    assert in_flight_exit.oldest_competitor == 0
    assert in_flight_exit.exit_start_timestamp == 0

    # some fields are not deleted
    assert in_flight_exit.exit_map != 0

    # assert IFE and piggyback bonds were sent to the owners
    assert testlang.get_balance(owner) == pre_balance + testlang.root_chain.inFlightExitBond() * 2
