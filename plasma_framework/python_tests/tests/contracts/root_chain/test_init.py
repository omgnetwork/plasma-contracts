import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import MIN_EXIT_PERIOD, NULL_ADDRESS


def test_exit_period_setting_has_effect(testlang):
    owner = testlang.accounts[0]
    deposit_id = testlang.deposit(owner, 100)

    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, 50)])
    testlang.start_in_flight_exit(spend_id)

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD)

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_input(spend_id, 0, owner)
