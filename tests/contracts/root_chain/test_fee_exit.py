import pytest
from eth_tester.exceptions import TransactionFailed

from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD
from tests.conftest import assert_event

pytestmark = pytest.mark.skip("WIP: moving tests to plasma framework")

# TODO: test if fee exit generates events


def test_start_fee_exit_should_succeed(testlang, plasma_framework):
    operator, amount = testlang.operator, 100
    exit_id, tx_hash = testlang.start_fee_exit(operator, amount)

    [exit_started] = testlang.flush_events()

    assert_event(exit_started, expected_event_name="ExitStarted", expected_event_args={"owner": operator.address, "exitId": exit_id})
    assert testlang.root_chain.exits(exit_id) == [operator.address, NULL_ADDRESS_HEX, amount, 1]


def test_start_fee_exit_non_operator_should_fail(testlang):
    amount = 100

    with pytest.raises(TransactionFailed):
        testlang.start_fee_exit(testlang.accounts[1], amount)


def test_start_fee_exit_finalizes_after_two_MFPs(testlang):
    operator, amount = testlang.accounts[0], 100
    testlang.deposit(operator, amount)
    testlang.flush_events()

    testlang.start_fee_exit(operator, amount)
    [exit_event] = testlang.flush_events()
    assert_event(exit_event, expected_event_name="ExitStarted", expected_event_args={"owner": operator.address})
    balance = testlang.get_balance(testlang.root_chain)

    testlang.forward_timestamp(MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    assert testlang.get_balance(testlang.root_chain) == balance

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    [exit_finalized] = testlang.flush_events()
    assert_event(exit_finalized, expected_event_name='ExitFinalized', expected_event_args={'exitId': exit_event['args']['exitId']})
    assert testlang.get_balance(testlang.root_chain) == 0
