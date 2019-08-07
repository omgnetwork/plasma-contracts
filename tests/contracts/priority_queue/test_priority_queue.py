import math

import pytest
from eth_tester.exceptions import TransactionFailed


@pytest.fixture
def priority_queue(get_contract, accounts):
    pql = get_contract('PriorityQueueLib')
    return get_contract(
        'PriorityQueueTest',
        args=[accounts[0].address], libraries={'PriorityQueueLib': pql.address}
    )


def del_min(priority_queue) -> int:
    w3 = priority_queue.web3
    tx_hash = priority_queue.delMin()
    receipt = w3.eth.getTransactionReceipt(tx_hash)
    events = priority_queue.events.DelMin().processReceipt(receipt)
    assert len(events) == 1
    return events[0]['args']['val']


def test_priority_queue_get_min_empty_should_fail(priority_queue):
    with pytest.raises(TransactionFailed):
        del_min(priority_queue)


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
    assert del_min(priority_queue) == 2
    assert priority_queue.currentSize() == 0


def test_priority_queue_delete_all(priority_queue):
    priority_queue.insert(5)
    priority_queue.insert(2)
    assert del_min(priority_queue) == 2
    assert del_min(priority_queue) == 5
    assert priority_queue.currentSize() == 0
    with pytest.raises(TransactionFailed):
        priority_queue.getMin()


def test_priority_insert_is_not_idempotent(priority_queue):
    priority_queue.insert(2)
    priority_queue.insert(2)
    assert del_min(priority_queue) == 2
    assert del_min(priority_queue) == 2
    assert priority_queue.currentSize() == 0


def test_priority_queue_delete_then_insert(priority_queue):
    priority_queue.insert(2)
    assert del_min(priority_queue) == 2
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


def run_test(w3, priority_queue, values):
    for i, value in enumerate(values):
        tx_hash = priority_queue.insert(value)
        gas = w3.eth.waitForTransactionReceipt(tx_hash)['gasUsed']
        if i != 0:  # at first insert there is a small additional cost - we take care of only the asymptotic cost
            assert gas <= op_cost(i + 1)

    for i in range(1, len(values)):
        assert i == priority_queue.functions.delMin().call()
        tx_hash = priority_queue.functions.delMin().transact()
        gas = w3.eth.waitForTransactionReceipt(tx_hash)['gasUsed']
        assert gas <= op_cost(len(values) - i)


def op_cost(n):
    tx_base_cost = 21000
    # Numbers were discovered experimentally. They represent upper bound of
    # gas cost of execution of delMin or insert operations.
    return tx_base_cost + 34923 + 6582 * math.floor(math.log(n, 2))


def test_priority_queue_worst_case_gas_cost(w3, priority_queue):
    values = list(range(1, 100))
    values.reverse()
    run_test(w3, priority_queue, values)


def test_priority_queue_average_case_gas_cost(w3, priority_queue):
    import random
    random.seed(a=0)
    values = list(range(1, 100))
    random.shuffle(values)
    run_test(w3, priority_queue, values)


def test_priority_queue_best_case_gas_cost(w3, priority_queue):
    values = list(range(1, 100))
    run_test(w3, priority_queue, values)


def test_del_min_can_be_called_by_owner_only(w3, get_contract, accounts):
    pql = get_contract('PriorityQueueLib')
    priority_queue = get_contract("PriorityQueue",
                                  args=[accounts[0].address],
                                  libraries={'PriorityQueueLib': pql.address}
                                  )  # without a proxy contract

    priority_queue.insert(7)

    with pytest.raises(TransactionFailed):
        priority_queue.delMin(**{'from': accounts[1].address})

    assert priority_queue.functions.delMin().call() == 7
    tx_hash = priority_queue.delMin(**{'from': accounts[0].address})
    receipt = w3.eth.waitForTransactionReceipt(tx_hash)

    assert receipt['status'] == 1
