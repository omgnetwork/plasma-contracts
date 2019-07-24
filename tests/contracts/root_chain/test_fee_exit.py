import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD

# TODO: test if fee exit generates events


def test_start_fee_exit_should_succeed(testlang):
    operator, amount = testlang.accounts[0], 100
    exit_id = testlang.start_fee_exit(operator, amount)

    [exit] = testlang.flush_events()
    assert {"owner": operator.address, "_event_type": b'ExitStarted'}.items() <= exit.items()
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
    [exit] = testlang.flush_events()
    assert {"owner": operator.address, "_event_type": b'ExitStarted'}.items() <= exit.items()
    balance = testlang.get_balance(testlang.root_chain)

    testlang.forward_timestamp(MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    assert testlang.get_balance(testlang.root_chain) == balance

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    [exit_finalized] = testlang.flush_events()
    assert {"exitId": exit['exitId'], "_event_type": b'ExitFinalized'}.items() <= exit_finalized.items()
    assert testlang.get_balance(testlang.root_chain) == 0
