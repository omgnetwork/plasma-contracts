import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK


def test_start_standard_exit_should_succeed(testlang, utxo):
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)
    assert testlang.root_chain.exits(utxo.spend_id) == [utxo.owner.address, NULL_ADDRESS_HEX, utxo.amount]


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


def test_start_standard_exit_twice_should_fail(testlang, utxo):
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id)


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


def test_start_standard_exit_by_non_owner_should_fail(testlang, utxo):
    mallory = testlang.accounts[1]
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id, sender=mallory)


def test_start_standard_exit_unknown_token_should_fail(testlang, token):
    utxo = testlang.create_utxo(token)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id)


def test_start_standard_exit_old_utxo_has_required_exit_period_to_start_exit(testlang, utxo):
    required_exit_period = WEEK  # see tesuji blockchain design
    minimal_required_period = WEEK  # see tesuji blockchain design
    mallory = testlang.accounts[1]

    testlang.forward_timestamp(required_exit_period + minimal_required_period)

    steal_id = testlang.spend_utxo(utxo.deposit_id, mallory, utxo.amount, mallory, force_invalid=True)
    testlang.start_standard_exit(mallory, steal_id)

    testlang.forward_timestamp(minimal_required_period - 1)
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)

    [utxoPos, _] = testlang.root_chain.getNextExit(NULL_ADDRESS)
    assert utxoPos == utxo.spend_id


def test_start_standard_exit_on_finalized_exit_should_fail(testlang, utxo):
    required_exit_period = WEEK  # see tesuji blockchain design
    minimal_required_period = WEEK  # see tesuji blockchain design
    testlang.start_standard_exit(utxo.owner, utxo.spend_id)
    testlang.forward_timestamp(required_exit_period + minimal_required_period)
    testlang.finalize_exits(NULL_ADDRESS, utxo.spend_id, 100)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.owner, utxo.spend_id)


def test_start_standard_exit_wrong_oindex_should_fail(testlang):
    from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
    from plasma_core.transaction import Transaction
    alice, bob, alice_money, bob_money = testlang.accounts[0], testlang.accounts[1], 10, 90

    deposit_id = testlang.deposit(alice, alice_money + bob_money)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    utxo = testlang.child_chain.get_transaction(deposit_id)
    spend_tx = Transaction(*decode_utxo_id(deposit_id),
                           0, 0, 0,
                           utxo.cur12,
                           alice.address, alice_money,
                           bob.address, bob_money)
    spend_tx.sign1(alice.key)
    blknum = testlang.submit_block([spend_tx])
    alice_utxo = encode_utxo_id(blknum, 0, 0)
    bob_utxo = encode_utxo_id(blknum, 0, 1)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(alice, bob_utxo)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(bob, alice_utxo)

    testlang.start_standard_exit(alice, alice_utxo)
    testlang.start_standard_exit(bob, bob_utxo)
