import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD
from plasma_core.transaction import Transaction
from plasma_core.utils.eip712_struct_hash import hash_struct
from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id


def test_start_standard_exit_should_succeed(testlang, utxo):
    testlang.start_standard_exit(utxo.spend_id, utxo.owner)
    assert testlang.get_standard_exit(utxo.spend_id) == [utxo.owner.address, NULL_ADDRESS_HEX, utxo.amount]


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
    assert testlang.get_standard_exit(output_id) == [owners[output_index].address, NULL_ADDRESS_HEX, 1]


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


def test_start_standard_exit_unknown_token_should_fail(testlang, token):
    utxo = testlang.create_utxo(token)

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

    [_, exit_id, _] = testlang.root_chain.getNextExit(NULL_ADDRESS)
    [_, _, _, position] = testlang.root_chain.exits(exit_id)
    assert position == utxo.spend_id


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
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    spend_tx = Transaction(inputs=[decode_utxo_id(deposit_id)],
                           outputs=[(alice.address, NULL_ADDRESS, alice_money), (bob.address, NULL_ADDRESS, bob_money)])
    spend_tx.sign(0, alice, verifyingContract=testlang.root_chain)
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

    assert testlang.get_standard_exit(deposit_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, amount]


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_standard_exit_on_piggyback_in_flight_exit_valid_output_owner_should_fail(testlang, num_outputs):
    # exit cross-spend test, case 9
    owner_1, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner_1, amount)
    outputs = []
    for i in range(0, num_outputs):
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, 1))
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], outputs)

    testlang.start_in_flight_exit(spend_id)

    output_index = num_outputs - 1
    testlang.piggyback_in_flight_exit_output(spend_id, output_index, testlang.accounts[output_index])

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.output_piggybacked(output_index)

    blknum, txindex, _ = decode_utxo_id(spend_id)
    output_id = encode_utxo_id(blknum, txindex, output_index)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(output_id, testlang.accounts[output_index])


@pytest.mark.parametrize("num_outputs", [1, 2, 3, 4])
def test_start_standard_exit_on_in_flight_exit_output_should_block_future_piggybacks(testlang, num_outputs):
    # exit cross-spend test, case 7
    owner_1, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner_1, amount)
    outputs = []
    for i in range(0, num_outputs):
        outputs.append((testlang.accounts[i].address, NULL_ADDRESS, 1))
    spend_id = testlang.spend_utxo([deposit_id], [owner_1], outputs)

    testlang.start_in_flight_exit(spend_id)

    output_index = num_outputs - 1

    blknum, txindex, _ = decode_utxo_id(spend_id)
    output_id = encode_utxo_id(blknum, txindex, output_index)
    testlang.start_standard_exit(output_id, account=testlang.accounts[output_index])

    with pytest.raises(TransactionFailed):
        testlang.piggyback_in_flight_exit_output(spend_id, output_index, testlang.accounts[output_index])

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert not in_flight_exit.output_piggybacked(output_index)
    assert in_flight_exit.output_blocked(output_index)


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
    spend_id = testlang.spend_utxo([utxo.spend_id], [alice], outputs)

    testlang.start_standard_exit(spend_id, alice)
    exit_id = testlang.get_standard_exit_id(spend_id)

    # let's prepare old schema signature for a transaction with an input of exited utxo
    spend_tx = Transaction(inputs=[decode_utxo_id(spend_id)], outputs=outputs)
    old_signature = alice.key.sign_msg_hash(spend_tx.hash).to_bytes()

    # challenge will fail on signature verification
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, old_signature)

    # sanity check: let's provide new schema signature for a challenge
    new_signature = alice.key.sign_msg_hash(hash_struct(spend_tx, verifyingContract=testlang.root_chain)).to_bytes()
    testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, new_signature)


def test_signature_scheme_respects_verifying_contract(testlang, utxo):
    alice = testlang.accounts[0]
    outputs = [(alice.address, NULL_ADDRESS, 50)]
    spend_id = testlang.spend_utxo([utxo.spend_id], [alice], outputs)

    testlang.start_standard_exit(spend_id, alice)
    exit_id = testlang.get_standard_exit_id(spend_id)

    spend_tx = Transaction(inputs=[decode_utxo_id(spend_id)], outputs=outputs)

    bad_contract_signature = alice.key.sign_msg_hash(hash_struct(spend_tx, verifyingContract=None)).to_bytes()

    # challenge will fail on signature verification
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, bad_contract_signature)

    # sanity check
    proper_signature = alice.key.sign_msg_hash(hash_struct(spend_tx, verifyingContract=testlang.root_chain)).to_bytes()
    testlang.root_chain.challengeStandardExit(exit_id, spend_tx.encoded, 0, proper_signature)
