import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.utils.address import address_to_hex
import math


@pytest.fixture
def priority_queue(get_contract, ethtester):
    pql = get_contract('PriorityQueueLib')
    return get_contract(
        'PriorityQueue',
        args=[address_to_hex(ethtester.a0)], libraries={'PriorityQueueLib': pql.address}
    )


def test_priority_queue_get_min_empty_should_fail(priority_queue):
    with pytest.raises(TransactionFailed):
        priority_queue.getMin()


def test_priority_queue_insert(priority_queue):
    priority_queue.insert(2)
    assert priority_queue.getMin() == 2
    assert priority_queue.currentSize() == 1


def test_priority_queue_insert_multiple(priority_queue):
    priority_queue.insert(2)
    priority_queue.insert(5)
    assert priority_queue.getMin() == 2
    assert priority_queue.currentSize() == 2


def test_priority_queue_insert_out_of_order(priority_queue):
    priority_queue.insert(5)
    priority_queue.insert(2)
    assert priority_queue.getMin() == 2


def test_priority_queue_delete_min(priority_queue):
    priority_queue.insert(2)
    assert priority_queue.delMin() == 2
    assert priority_queue.currentSize() == 0


def test_priority_queue_delete_all(priority_queue):
    priority_queue.insert(5)
    priority_queue.insert(2)
    assert priority_queue.delMin() == 2
    assert priority_queue.delMin() == 5
    assert priority_queue.currentSize() == 0
    with pytest.raises(TransactionFailed):
        priority_queue.getMin()


def test_priority_insert_is_not_idempotent(priority_queue):
    priority_queue.insert(2)
    priority_queue.insert(2)
    assert priority_queue.delMin() == 2
    assert priority_queue.delMin() == 2
    assert priority_queue.currentSize() == 0


def test_priority_queue_delete_then_insert(priority_queue):
    priority_queue.insert(2)
    assert priority_queue.delMin() == 2
    priority_queue.insert(5)
    assert priority_queue.getMin() == 5


def test_priority_queue_insert_spam_does_not_elevate_gas_cost_above_200k():
    two_weeks_of_gas = 8000000 * 4 * 60 * 24 * 14
    gas_left = two_weeks_of_gas
    size = 1
    while gas_left < 0:
        gas_left = gas_left - op_cost(size)
        size = size + 1
    assert op_cost(size) < 200000


def run_test(ethtester, priority_queue, values):
    for i, value in enumerate(values):
        if i % 10 == 0:
            ethtester.chain.mine()
        priority_queue.insert(value)
        gas = ethtester.chain.last_gas_used()
        assert gas <= op_cost(i + 1)
    for i in range(1, len(values)):
        if i % 10 == 0:
            ethtester.chain.mine()
        assert i == priority_queue.delMin()
        gas = ethtester.chain.last_gas_used()
        assert gas <= op_cost(len(values) - i)


def op_cost(n):
    tx_base_cost = 21000
    # Numbers were discovered experimentally. They represent upper bound of
    # gas cost of execution of delMin or insert operations.
    return tx_base_cost + 28677 + 6638 * math.floor(math.log(n, 2))


def test_priority_queue_worst_case_gas_cost(ethtester, priority_queue):
    values = list(range(1, 100))
    values.reverse()
    run_test(ethtester, priority_queue, values)


def test_priority_queue_average_case_gas_cost(ethtester, priority_queue):
    import random
    random.seed(a=0)
    values = list(range(1, 100))
    random.shuffle(values)
    run_test(ethtester, priority_queue, values)


def test_priority_queue_best_case_gas_cost(ethtester, priority_queue):
    values = list(range(1, 100))
    run_test(ethtester, priority_queue, values)


def test_del_min_can_be_called_by_owner_only(ethtester, priority_queue):
    priority_queue.insert(7)

    with pytest.raises(TransactionFailed):
        priority_queue.delMin(sender=ethtester.k1)

    assert priority_queue.delMin(sender=ethtester.k0) == 7
