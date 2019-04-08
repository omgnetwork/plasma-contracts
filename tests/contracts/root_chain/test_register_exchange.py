import pytest
from ethereum.tools.tester import TransactionFailed


def test_registering_exchange_should_succeed(testlang):
    exchange = testlang.accounts[0]
    testlang.register_exchange(exchange)
    registered_exchange = testlang.get_exchange(exchange)

    assert registered_exchange.registeredTimestamp > 0

    registered_exchanges_events = testlang.get_exchange_registered_events()

    assert len(registered_exchanges_events) == 1
    assert registered_exchanges_events[0]['exchange'] == exchange.address


def test_registering_exchange_without_putting_enough_bond_should_fail(testlang):
    exchange = testlang.accounts[0]

    with pytest.raises(TransactionFailed):
        testlang.register_exchange(exchange, bond=2)


def test_registering_the_same_exchange_twice_should_fail(testlang):
    exchange = testlang.accounts[0]
    testlang.register_exchange(exchange)
    testlang.get_exchange(exchange)

    with pytest.raises(TransactionFailed):
        testlang.register_exchange(exchange)
