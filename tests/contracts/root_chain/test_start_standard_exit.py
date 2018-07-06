import pytest
from ethereum.tools.tester import TransactionFailed


def test_start_standard_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)

    testlang.start_standard_exit(deposit_id, owner.key)

    assert testlang.root_chain.exits(deposit_id) == [owner.address, amount]


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_standard_exit_multiple_outputs_should_succeed(testlang, num_outputs):
    owners, amount, outputs = [], 100, []
    for i in range(0, num_outputs):
        owners.append(testlang.accounts[i])
        outputs.append((owners[i].address, 1))
    deposit_id = testlang.deposit(owners[0].address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owners[0].key], outputs)

    output_index = num_outputs - 1
    output_id = spend_id + output_index
    testlang.start_standard_exit(output_id, owners[output_index].key)

    assert testlang.root_chain.exits(output_id) == [owners[output_index].address, 1]


def test_start_standard_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)

    testlang.start_standard_exit(deposit_id, owner.key)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(deposit_id, owner.key)


def test_start_standard_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    deposit_tx = testlang.child_chain.get_transaction(deposit_id)
    bond = testlang.root_chain.standardExitBond()

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startStandardExit(deposit_id, deposit_tx.encoded, b'', value=bond)


def test_start_standard_exit_invalid_bond_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(deposit_id, owner.key, bond=0)
