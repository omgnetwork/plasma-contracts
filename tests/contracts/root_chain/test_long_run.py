import pytest
from plasma_core.constants import NULL_ADDRESS, DAY
import random
import datetime


def subtract(left, right):
    return [item for item in left if item not in right]


def pick(left):
    item = random.choice(left)
    return (subtract(left, [item]), item)


@pytest.mark.slow()
def test_slow(testlang):
    utxos = []
    random.seed(a=0)
    owner, amount = testlang.accounts[0], 100
    deposit_gas = 0
    submit_gas = 0
    exit_gas = 0
    challenge_gas = 0
    finalize_gas = 0

    # Loop:
    # 1. deposit few
    # 2. random spend
    # 3. exit something
    # 4. attempt to finalize

    # 10000 iterations correspond to 3 days of running time
    # To make test run for 16 hours (i.e. "overnight") set number of iterations to 2000
    for i in range(2000):
        print("[{}]: iteration {}; size {}".format(datetime.datetime.now(), i, len(utxos)))
        # 1. deposit few
        for _ in range(6):
            testlang.ethtester.chain.mine()
            deposit_id = testlang.deposit(owner.address, amount)
            deposit_gas = max(deposit_gas, testlang.ethtester.chain.last_gas_used())
            testlang.ethtester.chain.mine()
            spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
            submit_gas = max(submit_gas, testlang.ethtester.chain.last_gas_used())
            utxos.append(spend_id)

        testlang.forward_timestamp(DAY * 2)

        print("done depositing new")
        # 2. spend
        for _ in range(random.randint(2, 4)):
            testlang.ethtester.chain.mine()
            utxos, pos = pick(utxos)
            spend_id = testlang.spend_utxo(pos, owner, amount, owner)
            submit_gas = max(submit_gas, testlang.ethtester.chain.last_gas_used())
            utxos.append(spend_id)

        print("done spending")

        # 3. double-spend, exit and challenge
        for _ in range(random.randint(2, 4)):
            testlang.ethtester.chain.mine()
            utxos, pos = pick(utxos)
            spend_id = testlang.spend_utxo(pos, owner, amount, owner)
            submit_gas = max(submit_gas, testlang.ethtester.chain.last_gas_used())
            utxos.append(spend_id)
            testlang.ethtester.chain.mine()
            testlang.start_standard_exit(owner, pos)
            exit_gas = max(exit_gas, testlang.ethtester.chain.last_gas_used())
            testlang.ethtester.chain.mine()
            testlang.challenge_standard_exit(pos, spend_id)
            challenge_gas = max(challenge_gas, testlang.ethtester.chain.last_gas_used())

        print("done double-spending")
        # 4. exit
        for _ in range(random.randint(2, 4)):
            testlang.ethtester.chain.mine()
            utxos, pos = pick(utxos)
            testlang.start_standard_exit(owner, pos)
            exit_gas = max(exit_gas, testlang.ethtester.chain.last_gas_used())

        print("done exiting")
        testlang.ethtester.chain.mine()
        # 4. attempt to finalize
        testlang.finalize_exits(NULL_ADDRESS, 0, 3)
        finalize_gas = max(finalize_gas, testlang.ethtester.chain.last_gas_used())
        print("deposit gas is {}".format(deposit_gas))
        print("submit gas is {}".format(submit_gas))
        print("exit gas is {}".format(exit_gas))
        print("challenge gas is {}".format(challenge_gas))
        print("finalize (x3) gas is {}".format(finalize_gas))
        print("done finalizing")

    assert deposit_gas <= 49300
    assert submit_gas <= 52365
    assert exit_gas <= 132018
    assert challenge_gas <= 18635
    assert finalize_gas <= 4328
