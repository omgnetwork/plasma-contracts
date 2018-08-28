import pytest
from ethereum.tools.tester import TransactionFailed


@pytest.fixture
def priority_queue(get_contract):
    return get_contract('PriorityQueue')


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


def test_priority_queue_delete_then_insert(priority_queue):
    priority_queue.insert(2)
    assert priority_queue.delMin() == 2
    priority_queue.insert(5)
    assert priority_queue.getMin() == 5


def run_test(ethtester, priority_queue, values):
    max_gas = 0
    for i, value in enumerate(values):
        if i % 10 == 0:
            ethtester.chain.mine()
        priority_queue.insert(value)
        gas = ethtester.chain.last_gas_used()
        max_gas = max(max_gas, gas)
    max_gas_insert = max_gas
    max_gas = 0
    for i in range(1, len(values)):
        if i % 10 == 0:
            ethtester.chain.mine()
        assert i == priority_queue.delMin()
        gas = ethtester.chain.last_gas_used()
        max_gas = max(max_gas, gas)
    return (max_gas_insert, max_gas)


# insert_cost_max = lambda n: 21000 + 26538 + 6638 * math.floor(math.log(n, 2))
def test_priority_queue_worst_case_gas_cost(ethtester, priority_queue):
    values = list(range(1, 100))
    values.reverse()
    mgi, mgd = run_test(ethtester, priority_queue, values)
    assert mgi == 77666
    assert mgd == 65144


def test_priority_queue_average_case_gas_cost(ethtester, priority_queue):
    import random
    random.seed(a=0)
    values = list(range(1, 100))
    random.shuffle(values)
    mgi, mgd = run_test(ethtester, priority_queue, values)
    assert mgi == 71028
    assert mgd == 73292


def test_priority_queue_best_case_gas_cost(ethtester, priority_queue):
    values = list(range(1, 100))
    mgi, mgd = run_test(ethtester, priority_queue, values)
    assert mgi == 47538
    assert mgd == 73188
