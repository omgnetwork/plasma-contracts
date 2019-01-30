import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD


def test_start_standard_exit_should_succeed(testlang, utxo):
    testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)
    assert testlang.root_chain.exits(utxo.spend_id << 1) == [utxo.owner.address, NULL_ADDRESS_HEX, utxo.amount]


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_standard_exit_multiple_outputs_should_succeed(testlang, num_outputs):
    owners, amount, outputs = [], 100, []
    for i in range(0, num_outputs):
        owners.append(testlang.accounts[i])
        outputs.append((owners[i].address, NULL_ADDRESS, 1))
    deposit_id = testlang.deposit(owners[0], amount)
    spend_id = testlang.spend_utxo([deposit_id], [owners[0].key], outputs)

    output_index = num_outputs - 1
    output_id = spend_id + output_index
    testlang.start_standard_exit(output_id, owners[output_index].key)
    assert testlang.root_chain.exits(output_id << 1) == [owners[output_index].address, NULL_ADDRESS_HEX, 1]


def test_start_standard_exit_twice_should_fail(testlang, utxo):
    testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)


def test_start_standard_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    deposit_tx = testlang.child_chain.get_transaction(deposit_id)
    bond = testlang.root_chain.standardExitBond()

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startStandardExit(deposit_id, deposit_tx.encoded, b'', value=bond)


def test_start_standard_exit_invalid_bond_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(deposit_id, owner.key, bond=0)


def test_start_standard_exit_by_non_owner_should_fail(testlang, utxo):
    mallory = testlang.accounts[1]
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, mallory.key)


def test_start_standard_exit_unknown_token_should_fail(testlang, token):
    utxo = testlang.create_utxo(token)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)


def test_start_standard_exit_old_utxo_has_required_exit_period_to_start_exit(testlang, utxo):
    required_exit_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    minimal_required_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    mallory = testlang.accounts[1]

    testlang.forward_timestamp(required_exit_period + minimal_required_period)

    steal_id = testlang.spend_utxo([utxo.deposit_id], [mallory.key], [(mallory.address, NULL_ADDRESS, utxo.amount)], force_invalid=True)
    testlang.start_standard_exit(steal_id, mallory.key)

    testlang.forward_timestamp(minimal_required_period - 1)
    testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)

    [_, exitId, _] = testlang.root_chain.getNextExit(NULL_ADDRESS)
    assert exitId >> 1 == utxo.spend_id


def test_start_standard_exit_on_finalized_exit_should_fail(testlang, utxo):
    required_exit_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    minimal_required_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)
    testlang.forward_timestamp(required_exit_period + minimal_required_period)
    testlang.process_exits(NULL_ADDRESS, utxo.spend_id, 100)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, utxo.owner.key)


def test_start_standard_exit_wrong_oindex_should_fail(testlang):
    from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
    from plasma_core.transaction import Transaction
    alice, bob, alice_money, bob_money = testlang.accounts[0], testlang.accounts[1], 10, 90

    deposit_id = testlang.deposit(alice, alice_money + bob_money)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    spend_tx = Transaction(inputs=[decode_utxo_id(deposit_id)], outputs=[(alice.address, NULL_ADDRESS, alice_money), (bob.address, NULL_ADDRESS, bob_money)])
    spend_tx.sign(0, alice.key)
    blknum = testlang.submit_block([spend_tx])
    alice_utxo = encode_utxo_id(blknum, 0, 0)
    bob_utxo = encode_utxo_id(blknum, 0, 1)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(bob_utxo, alice.key)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(alice_utxo, bob.key)

    testlang.start_standard_exit(alice_utxo, alice.key)
    testlang.start_standard_exit(bob_utxo, bob.key)


def test_start_standard_exit_from_deposit_must_be_exitable_in_minimal_finalization_period(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_standard_exit(deposit_id, owner.key)

    required_exit_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    testlang.forward_timestamp(required_exit_period + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    assert testlang.root_chain.exits(deposit_id << 1) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, amount]
