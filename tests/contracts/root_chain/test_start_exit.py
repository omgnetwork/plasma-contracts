import pytest
from ethereum.tools.tester import TransactionFailed


def test_start_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_exit(deposit_id, owner)

    plasma_exit = testlang.get_plasma_exit(deposit_id)
    assert plasma_exit.owner == owner.address
    assert plasma_exit.amount == amount


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_exit_multiple_outputs_should_succeed(testlang, num_outputs):
    owners, amount, outputs = [], 100, []
    for i in range(0, num_outputs):
        owners.append(testlang.accounts[i])
        outputs.append((owners[i], 1))
    deposit_id = testlang.deposit(owners[0], amount)
    spend_id = testlang.spend_utxo([deposit_id], outputs, [owners[0]])

    output_index = num_outputs - 1
    output_id = spend_id + output_index
    testlang.start_exit(output_id, owners[output_index])

    plasma_exit = testlang.get_plasma_exit(output_id)
    assert plasma_exit.owner == owners[output_index].address
    assert plasma_exit.amount == 1


def test_start_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_exit(deposit_id, owner)

    with pytest.raises(TransactionFailed):
        testlang.start_exit(deposit_id, owner)


def test_start_exit_invalid_owner_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_exit(deposit_id, owner_2)


def test_start_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    deposit_tx = testlang.transactions[deposit_id]
    bond = testlang.root_chain.exitBond()

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startExit(deposit_id, deposit_tx.encoded, b'', value=bond)


def test_start_exit_invalid_bond_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_exit(deposit_id, owner, bond=0)
