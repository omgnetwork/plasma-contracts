import pytest
from eth_utils import keccak
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD
from plasma_core.transaction import Transaction, amend_signature
from plasma_core.utils.eip712_struct_hash import hash_struct
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
from testlang.testlang import StandardExit


def test_start_standard_exit_should_succeed(testlang, utxo):
    testlang.start_standard_exit(utxo.spend_id, utxo.owner)
    assert testlang.get_standard_exit(utxo.spend_id) == [utxo.owner.address, utxo.amount, utxo.spend_id, True]


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_standard_exit_multiple_outputs_should_succeed(testlang, num_outputs):
    owners, amount, outputs = [], 100, []
    for i in range(0, num_outputs):
        owners.append(testlang.accounts[i])
        outputs.append((owners[i].address, NULL_ADDRESS, 1))
    deposit_id = testlang.deposit(owners[0], amount)
    spend_id = testlang.spend_utxo([deposit_id], [owners[0]], outputs)

    output_index = num_outputs - 1
    output_id = spend_id + output_index
    testlang.start_standard_exit(output_id, owners[output_index])
    assert testlang.get_standard_exit(output_id) == [owners[output_index].address, 1, output_id, True]


def test_start_standard_exit_twice_should_fail(testlang, utxo):
    testlang.start_standard_exit(utxo.spend_id, utxo.owner)
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, utxo.owner)


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
        testlang.start_standard_exit(deposit_id, owner, bond=0)


def test_start_standard_exit_by_non_owner_should_fail(testlang, utxo):
    mallory = testlang.accounts[1]
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, mallory)


def test_start_standard_exit_unknown_token_should_fail(testlang, no_exit_queue_token):
    utxo = testlang.create_utxo(no_exit_queue_token)
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, utxo.owner)


def test_start_standard_exit_old_utxo_has_required_exit_period_to_start_exit(testlang, utxo):
    required_exit_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    minimal_required_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    mallory = testlang.accounts[1]

    testlang.forward_timestamp(required_exit_period + minimal_required_period)

    steal_id = testlang.spend_utxo([utxo.deposit_id], [mallory], [(mallory.address, NULL_ADDRESS, utxo.amount)],
                                   force_invalid=True)
    testlang.start_standard_exit(steal_id, mallory)

    testlang.forward_timestamp(minimal_required_period - 1)
    testlang.start_standard_exit(utxo.spend_id, utxo.owner)

    _, _, next_exit_id = testlang.root_chain.getNextExit(testlang.root_chain.eth_vault_id, NULL_ADDRESS)
    exits = testlang.root_chain.exits(next_exit_id)
    next_exit = StandardExit(*exits[0])
    assert next_exit.position == utxo.spend_id


def test_start_standard_exit_on_finalized_exit_should_fail(testlang, utxo):
    required_exit_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    minimal_required_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    testlang.start_standard_exit(utxo.spend_id, utxo.owner)
    testlang.forward_timestamp(required_exit_period + minimal_required_period)
    testlang.process_exits(NULL_ADDRESS, 0, 100)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(utxo.spend_id, utxo.owner)


def test_start_standard_exit_wrong_oindex_should_fail(testlang):
    alice, bob, alice_money, bob_money = testlang.accounts[0], testlang.accounts[1], 10, 90

    deposit_id = testlang.deposit(alice, alice_money + bob_money)

    spend_tx = Transaction(inputs=[decode_utxo_id(deposit_id)],
                           outputs=[(alice.address, NULL_ADDRESS, alice_money), (bob.address, NULL_ADDRESS, bob_money)])
    spend_tx.sign(0, alice, verifying_contract=testlang.root_chain)
    blknum = testlang.submit_block([spend_tx])
    alice_utxo = encode_utxo_id(blknum, 0, 0)
    bob_utxo = encode_utxo_id(blknum, 0, 1)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(bob_utxo, alice)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(alice_utxo, bob)

    testlang.start_standard_exit(alice_utxo, alice)
    testlang.start_standard_exit(bob_utxo, bob)


def test_start_standard_exit_from_deposit_must_be_exitable_in_minimal_finalization_period(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_standard_exit(deposit_id, owner)

    required_exit_period = MIN_EXIT_PERIOD  # see tesuji blockchain design
    testlang.forward_timestamp(required_exit_period + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    assert testlang.get_standard_exit(deposit_id) == [NULL_ADDRESS_HEX, 0, 0, False]


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_standard_exit_on_finalized_in_flight_exit_output_should_fail(testlang, num_outputs):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    outputs = [(owner.address, NULL_ADDRESS, 1)] * num_outputs
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs)
    output_index = num_outputs - 1

    # start IFE, piggyback one output and process the exit
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, output_index, owner)
    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)
    testlang.process_exits(NULL_ADDRESS, 0, 1)

    blknum, txindex, _ = decode_utxo_id(spend_id)

    # all not finalized outputs can exit via SE
    for i in range(output_index):
        output_id = encode_utxo_id(blknum, txindex, i)
        testlang.start_standard_exit(output_id, account=owner)

    # an already finalized output __cannot__ exit via SE
    with pytest.raises(TransactionFailed):
        output_id = encode_utxo_id(blknum, txindex, output_index)
        testlang.start_standard_exit(output_id, account=owner)


def test_start_standard_exit_from_two_deposits_with_the_same_amount_and_owner_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    first_deposit_id = testlang.deposit(owner, amount)
    second_deposit_id = testlang.deposit(owner, amount)

    # SE ids should be different
    assert testlang.get_standard_exit_id(first_deposit_id) != testlang.get_standard_exit_id(second_deposit_id)

    testlang.start_standard_exit(first_deposit_id, owner)

    # should start a SE of a similar deposit (same owner and amount)
    testlang.start_standard_exit(second_deposit_id, owner)


def test_old_signature_scheme_does_not_work_any_longer(testlang, utxo):
    # In this test I will challenge standard exit with old signature schema to show it no longer works
    # Then passing new signature to the same challenge data, challenge will succeed
    alice = testlang.accounts[0]
    outputs = [(alice.address, NULL_ADDRESS, 50)]
    exiting_tx_id = testlang.spend_utxo([utxo.spend_id], [alice], outputs)
    exiting_tx = testlang.child_chain.get_transaction(exiting_tx_id)

    testlang.start_standard_exit(exiting_tx_id, alice)
    exit_id = testlang.get_standard_exit_id(exiting_tx_id)

    # let's prepare old schema signature for a transaction with an input of exited utxo
    spend_tx = Transaction(inputs=[decode_utxo_id(exiting_tx_id)], outputs=outputs)
    old_signature = amend_signature(alice.key.sign_msg_hash(spend_tx.hash).to_bytes())

    # challenge will fail on signature verification
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, old_signature, exiting_tx.encoded, keccak(hexstr=testlang.accounts[0].address))

    # sanity check: let's provide new schema signature for a challenge
    new_signature = amend_signature(alice.key.sign_msg_hash(hash_struct(spend_tx, verifying_contract=testlang.root_chain)).to_bytes())
    testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, new_signature, exiting_tx.encoded, keccak(hexstr=testlang.accounts[0].address))


def test_signature_scheme_respects_verifying_contract(testlang, utxo):
    alice = testlang.accounts[0]
    outputs = [(alice.address, NULL_ADDRESS, 50)]
    exiting_tx_id = testlang.spend_utxo([utxo.spend_id], [alice], outputs)
    exiting_tx = testlang.child_chain.get_transaction(exiting_tx_id)

    testlang.start_standard_exit(exiting_tx_id, alice)
    exit_id = testlang.get_standard_exit_id(exiting_tx_id)

    spend_tx = Transaction(inputs=[decode_utxo_id(exiting_tx_id)], outputs=outputs)

    bad_contract_signature = amend_signature(alice.key.sign_msg_hash(hash_struct(spend_tx, verifying_contract=None)).to_bytes())

    # challenge will fail on signature verification
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, bad_contract_signature, exiting_tx.encoded, keccak(hexstr=testlang.accounts[0].address))

    # sanity check
    proper_signature = amend_signature(alice.key.sign_msg_hash(hash_struct(spend_tx, verifying_contract=testlang.root_chain)).to_bytes())
    testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, proper_signature, exiting_tx.encoded, keccak(hexstr=testlang.accounts[0].address))
