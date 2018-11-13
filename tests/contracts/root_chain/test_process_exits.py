from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK
from eth_utils import encode_hex
import pytest
from ethereum.tools.tester import TransactionFailed


def test_process_exits_standard_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    pre_balance = testlang.get_balance(owner)

    testlang.start_standard_exit(owner, spend_id)
    testlang.forward_timestamp(2 * WEEK + 1)

    testlang.process_exits(NULL_ADDRESS, spend_id, 100)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.token == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount
    assert testlang.get_balance(owner) == pre_balance + amount


def test_process_exits_in_flight_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, 100)])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner.key)
    testlang.forward_timestamp(2 * WEEK)

    testlang.process_exits()

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == 0
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.oldest_competitor == 0

    for i in range(0, 4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.owner == NULL_ADDRESS_HEX
        assert input_info.amount == 0

        output_info = in_flight_exit.get_output(i)
        assert output_info.owner == NULL_ADDRESS_HEX
        assert output_info.amount == 0


def test_finalize_exits_for_ERC20_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)

    testlang.start_standard_exit(owner, spend_id)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.token == encode_hex(token.address)
    assert standard_exit.owner == owner.address
    testlang.forward_timestamp(2 * WEEK + 1)

    pre_balance = token.balanceOf(owner.address)
    testlang.process_exits(token.address, spend_id, 100)

    plasma_exit = testlang.get_standard_exit(spend_id)
    assert plasma_exit.token == encode_hex(token.address)
    assert plasma_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount
    assert token.balanceOf(owner.address) == pre_balance + amount


# TODO: add test_process_exits_in_flight_for_ERC20_should_succeed


def test_finalize_exits_old_utxo_is_mature_after_single_mfp(testlang):
    minimal_finalization_period = WEEK  # aka MFP - see tesuji blockchain design
    required_exit_period = WEEK  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    testlang.forward_timestamp(required_exit_period)
    testlang.start_standard_exit(owner, spend_id)
    testlang.forward_timestamp(minimal_finalization_period)

    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    testlang.forward_timestamp(1)
    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id).owner == NULL_ADDRESS_HEX


def test_finalize_exits_new_utxo_is_mature_after_mfp_plus_rep(testlang):
    minimal_finalization_period = WEEK  # aka MFP - see tesuji blockchain design
    required_exit_period = WEEK  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id)

    testlang.forward_timestamp(required_exit_period)
    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id).owner == owner.address

    testlang.forward_timestamp(minimal_finalization_period + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id).owner == NULL_ADDRESS_HEX


def test_finalize_exits_only_mature_exits_are_processed(testlang):
    minimal_finalization_period = WEEK  # aka MFP - see tesuji blockchain design
    required_exit_period = WEEK  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo(deposit_id_1, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id_1)

    testlang.forward_timestamp(required_exit_period + minimal_finalization_period + 1)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id_2 = testlang.spend_utxo(deposit_id_2, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id_2)

    assert testlang.get_standard_exit(spend_id_1).owner == owner.address
    assert testlang.get_standard_exit(spend_id_2).owner == owner.address
    testlang.process_exits(NULL_ADDRESS, 0, 100)
    assert testlang.get_standard_exit(spend_id_1).owner == NULL_ADDRESS_HEX
    assert testlang.get_standard_exit(spend_id_2).owner == owner.address


def test_finalize_exits_for_uninitialized_ERC20_should_fail(testlang, root_chain, token):
    assert not root_chain.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        testlang.process_exits(token.address, 0, 100)


def test_finalize_exits_partial_queue_processing(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo(deposit_id_1, owner, 100, owner)
    testlang.confirm_spend(spend_id_1, owner)
    testlang.start_standard_exit(owner, spend_id_1)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id_2 = testlang.spend_utxo(deposit_id_2, owner, 100, owner)
    testlang.confirm_spend(spend_id_2, owner)
    testlang.start_standard_exit(owner, spend_id_2)

    testlang.forward_timestamp(2 * WEEK + 1)
    testlang.process_exits(NULL_ADDRESS, spend_id_1, 1)
    plasma_exit = testlang.get_standard_exit(spend_id_1)
    assert plasma_exit.owner == NULL_ADDRESS_HEX
    plasma_exit = testlang.get_standard_exit(spend_id_2)
    assert plasma_exit.owner == owner.address


def test_finalize_exits_tx_race_short_circuit(testlang):
    utxo1 = testlang.create_utxo()
    utxo2 = testlang.create_utxo()
    utxo3 = testlang.create_utxo()
    utxo4 = testlang.create_utxo()
    testlang.start_standard_exit(utxo1.owner, utxo1.spend_id)
    testlang.start_standard_exit(utxo2.owner, utxo2.spend_id)
    testlang.start_standard_exit(utxo3.owner, utxo3.spend_id)
    testlang.start_standard_exit(utxo4.owner, utxo4.spend_id)

    testlang.forward_timestamp(2 * WEEK + 1)
    testlang.process_exits(NULL_ADDRESS, utxo1.spend_id, 1)
    with pytest.raises(TransactionFailed):
        testlang.process_exits(NULL_ADDRESS, utxo1.spend_id, 3, startgas=1000000)
    short_circuit_gas = testlang.ethtester.chain.last_gas_used()
    assert short_circuit_gas < 67291  # value from _tx_race_normal


def test_finalize_exits_tx_race_normal(testlang):
    utxo1 = testlang.create_utxo()
    utxo2 = testlang.create_utxo()
    utxo3 = testlang.create_utxo()
    utxo4 = testlang.create_utxo()
    testlang.start_standard_exit(utxo1.owner, utxo1.spend_id)
    testlang.start_standard_exit(utxo2.owner, utxo2.spend_id)
    testlang.start_standard_exit(utxo3.owner, utxo3.spend_id)
    testlang.start_standard_exit(utxo4.owner, utxo4.spend_id)

    testlang.forward_timestamp(2 * WEEK + 1)
    testlang.process_exits(NULL_ADDRESS, utxo1.spend_id, 1)

    testlang.process_exits(NULL_ADDRESS, utxo2.spend_id, 3)
    three_exits_tx_gas = testlang.ethtester.chain.last_gas_used()
    assert three_exits_tx_gas > 3516  # value from _tx_race_short_circuit


def test_finalize_exits_empty_queue_should_crash(testlang, ethtester):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo(deposit_id_1, owner, 100, owner)
    testlang.confirm_spend(spend_id_1, owner)
    testlang.start_standard_exit(owner, spend_id_1)

    testlang.forward_timestamp(2 * WEEK + 1)
    testlang.process_exits(NULL_ADDRESS, spend_id_1, 1)

    with pytest.raises(TransactionFailed):
        testlang.process_exits(NULL_ADDRESS, spend_id_1, 1)
    with pytest.raises(TransactionFailed):
        testlang.process_exits(NULL_ADDRESS, 0, 1)


def test_finalize_skipping_top_utxo_check_is_possible(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo(deposit_id_1, owner, 100, owner)
    testlang.confirm_spend(spend_id_1, owner)
    testlang.start_standard_exit(owner, spend_id_1)

    testlang.forward_timestamp(2 * WEEK + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    standard_exit = testlang.get_standard_exit(spend_id_1)
    assert standard_exit.owner == NULL_ADDRESS_HEX


def test_finalize_challenged_exit_will_not_send_funds(testlang):
    owner, finalizer, amount = testlang.accounts[0], testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)

    testlang.start_standard_exit(owner, spend_id)
    doublespend_id = testlang.spend_utxo(spend_id, owner, 100, owner)

    testlang.challenge_standard_exit(spend_id, doublespend_id)
    testlang.root_chain.exits(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]

    testlang.forward_timestamp(2 * WEEK + 1)

    pre_balance = testlang.get_balance(testlang.root_chain)
    testlang.process_exits(NULL_ADDRESS, 0, 1, sender=finalizer.key)
    post_balance = testlang.get_balance(testlang.root_chain)
    assert post_balance == pre_balance


def test_finalized_exit_challenge_will_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id)
    testlang.forward_timestamp(2 * WEEK + 1)

    testlang.process_exits(NULL_ADDRESS, spend_id, 100)
    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    doublespend_id = testlang.spend_utxo(spend_id, owner, 100, owner)
    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(spend_id, doublespend_id)
