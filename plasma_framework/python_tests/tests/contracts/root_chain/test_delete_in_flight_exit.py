import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD

FIRST_PERIOD_OVER = MIN_EXIT_PERIOD + 1


def test_delete_in_flight_exit_delete_exit_data_and_returns_bond(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_in_flight_exit(spend_id)
    testlang.forward_timestamp(FIRST_PERIOD_OVER)

    pre_balance = testlang.get_balance(owner)
    testlang.delete_in_flight_exit(spend_id)
    post_balance = testlang.get_balance(owner)

    assert post_balance == pre_balance + testlang.root_chain.inFlightExitBond()

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == 0
    assert in_flight_exit.exit_map == 0
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.oldest_competitor == 0


def test_can_restart_exit_after_deletion(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_in_flight_exit(spend_id)
    testlang.forward_timestamp(FIRST_PERIOD_OVER)
    testlang.delete_in_flight_exit(spend_id)
    testlang.start_in_flight_exit(spend_id)


def test_piggyback_on_deleted_exit_fails(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_in_flight_exit(spend_id)
    testlang.forward_timestamp(FIRST_PERIOD_OVER)
    testlang.delete_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, 0, owner)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_output(spend_id, 0, owner)


def test_deletion_fails_when_exit_is_in_first_phase(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.delete_in_flight_exit(spend_id)


def test_deletion_fails_when_already_piggybacked(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_input(spend_id, 0, owner)
    testlang.forward_timestamp(FIRST_PERIOD_OVER)

    with pytest.raises(TransactionFailed):
        testlang.delete_in_flight_exit(spend_id)
