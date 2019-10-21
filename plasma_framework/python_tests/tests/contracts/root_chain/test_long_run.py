import datetime
import random

import pytest

from plasma_core.constants import NULL_ADDRESS, DAY


def subtract(left, right):
    return [item for item in left if item not in right]


def pick(left):
    item = random.choice(left)
    return subtract(left, [item]), item


@pytest.mark.skip("WIP: still failing")
@pytest.mark.slow()
def test_slow(testlang, w3):
    utxos = []
    random.seed(a=0)
    owner, amount = testlang.accounts[0], 100
    max_gas = 0

    # Loop:
    # 1. deposit few
    # 2. random spend
    # 3. exit something
    # 4. attempt to finalize

    for i in range(1000):
        print(f'[{datetime.datetime.now()}]: iteration {i}')
        # 1. deposit few
        for _ in range(5):
            deposit_id = testlang.deposit(owner, amount)
            max_gas = max(max_gas, testlang.w3.eth.last_gas_used)
            spend_id = testlang.spend_utxo([deposit_id], [owner], [(owner.address, NULL_ADDRESS, amount)])
            max_gas = max(max_gas, testlang.w3.eth.last_gas_used)
            utxos.append(spend_id)

        w3.eth.increase_time(DAY * 2)

        # 2. spend
        for _ in range(random.randint(2, 4)):
            utxos, pos = pick(utxos)
            spend_id = testlang.spend_utxo([pos], [owner], [(owner.address, NULL_ADDRESS, amount)])
            max_gas = max(max_gas, testlang.w3.eth.last_gas_used)
            utxos.append(spend_id)

        # 3. double-spend, exit and challenge
        for _ in range(random.randint(2, 4)):
            utxos, pos = pick(utxos)
            spend_id = testlang.spend_utxo([pos], [owner], [(owner.address, NULL_ADDRESS, amount)])
            max_gas = max(max_gas, testlang.w3.eth.last_gas_used)
            utxos.append(spend_id)
            testlang.start_standard_exit(pos, owner)
            testlang.challenge_standard_exit(pos, spend_id)

        # 4. exit
        for _ in range(random.randint(2, 4)):
            utxos, pos = pick(utxos)
            testlang.start_standard_exit(pos, owner)
            max_gas = max(max_gas, testlang.w3.eth.last_gas_used)

        # 4. attempt to finalize
        testlang.process_exits(NULL_ADDRESS, 0, 3)
        max_gas = max(max_gas, testlang.w3.eth.last_gas_used)
        print(f'max_gas is {max_gas}')

    assert max_gas < 400000
