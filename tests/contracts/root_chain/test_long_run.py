import pytest
from plasma_core.constants import NULL_ADDRESS, DAY
import random
import datetime


def subtract(left, right):
    return [item for item in left if item not in right]


def pick(left):
    item = random.choice(left)
    return subtract(left, [item]), item


@pytest.mark.slow()
def test_slow(testlang):
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
        print("[{}]: iteration {}".format(datetime.datetime.now(), i))
        # 1. deposit few
        for _ in range(5):
            deposit_id = testlang.deposit(owner, amount)
            max_gas = max(max_gas, testlang.ethtester.chain.last_gas_used())
            spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
            max_gas = max(max_gas, testlang.ethtester.chain.last_gas_used())
            utxos.append(spend_id)

        testlang.forward_timestamp(DAY * 2)

        testlang.ethtester.chain.mine()
        # 2. spend
        for _ in range(random.randint(2, 4)):
            utxos, pos = pick(utxos)
            spend_id = testlang.spend_utxo(pos, owner, amount, owner)
            max_gas = max(max_gas, testlang.ethtester.chain.last_gas_used())
            utxos.append(spend_id)

        # 3. double-spend, exit and challenge
        for _ in range(random.randint(2, 4)):
            utxos, pos = pick(utxos)
            spend_id = testlang.spend_utxo(pos, owner, amount, owner)
            max_gas = max(max_gas, testlang.ethtester.chain.last_gas_used())
            utxos.append(spend_id)
            testlang.start_standard_exit(owner, pos)
            testlang.challenge_standard_exit(pos, spend_id)

        testlang.ethtester.chain.mine()
        # 4. exit
        for _ in range(random.randint(2, 4)):
            utxos, pos = pick(utxos)
            testlang.start_standard_exit(owner, pos)
            max_gas = max(max_gas, testlang.ethtester.chain.last_gas_used())

        testlang.ethtester.chain.mine()
        # 4. attempt to finalize
        testlang.process_exits(NULL_ADDRESS, 0, 3)
        max_gas = max(max_gas, testlang.ethtester.chain.last_gas_used())
        print("max_gas is {}".format(max_gas))

    assert max_gas < 200000
