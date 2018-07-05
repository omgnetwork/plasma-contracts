import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.utils.transactions import encode_utxo_id, decode_utxo_id
from plasma_core.utils.address import address_to_bytes
from plasma_core.utils.utils import get_deposit_hash
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX


# deposit
def test_deposit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_blknum = testlang.deposit(owner, amount)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), NULL_ADDRESS, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.currentDepositBlock() == 2


# startDepositExit
def test_start_deposit_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)

    testlang.start_deposit_exit(owner, deposit_blknum, amount)

    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    plasma_exit = testlang.get_plasma_exit(deposit_id)
    assert plasma_exit.owner == owner.address
    assert plasma_exit.token == NULL_ADDRESS_HEX
    assert plasma_exit.amount == amount


def test_start_deposit_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)

    testlang.start_deposit_exit(owner, deposit_blknum, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, deposit_blknum, amount)


def test_start_deposit_exit_wrong_owner_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(testlang.accounts[1], deposit_blknum, amount)


def test_start_deposit_exit_wrong_amount_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, deposit_blknum, 999)


def test_start_deposit_exit_wrong_blknum_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, deposit_blknum + 1, amount)


def test_start_deposit_exit_child_blknum_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    testlang.deposit(owner, amount)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, 1000, amount)


# startFeeExit
def test_start_fee_exit_should_succeed(testlang):
    operator, amount = testlang.accounts[0], 100

    fee_exit_id = testlang.start_fee_exit(operator, amount)

    plasma_exit = testlang.get_plasma_exit(fee_exit_id)
    assert plasma_exit.owner == operator.address
    assert plasma_exit.token == NULL_ADDRESS_HEX
    assert plasma_exit.amount == amount


def test_start_fee_exit_non_operator_should_fail(testlang):
    amount = 100

    with pytest.raises(TransactionFailed):
        testlang.start_fee_exit(testlang.accounts[1], amount)


# startExit
def test_start_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id, owner)

    testlang.start_exit(owner, spend_id)

    plasma_exit = testlang.get_plasma_exit(spend_id)
    assert plasma_exit.owner == owner.address
    assert plasma_exit.token == NULL_ADDRESS_HEX
    assert plasma_exit.amount == amount


def test_start_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id, owner)

    testlang.start_exit(owner, spend_id)

    with pytest.raises(TransactionFailed):
        testlang.start_exit(owner, spend_id)


def test_start_exit_wrong_owner_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id, owner)

    with pytest.raises(TransactionFailed):
        testlang.start_exit(testlang.accounts[1], spend_id)


# challengeExit
def test_challenge_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id_1 = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id_1, owner)
    testlang.start_exit(owner, spend_id_1)
    spend_id_2 = testlang.spend_utxo(spend_id_1, owner, amount, owner)
    testlang.confirm_spend(spend_id_2, owner)

    testlang.challenge_exit(spend_id_1, spend_id_2)

    plasma_exit = testlang.get_plasma_exit(spend_id_1)
    assert plasma_exit.owner == NULL_ADDRESS_HEX


def test_challenge_exit_invalid_challenge_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id, owner)
    testlang.start_exit(owner, spend_id)

    with pytest.raises(TransactionFailed):
        testlang.challenge_exit(spend_id, spend_id)


def test_challenge_exit_invalid_proof_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id_1 = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id_1, owner)
    testlang.start_exit(owner, spend_id_1)
    spend_id_2 = testlang.spend_utxo(spend_id_1, owner, amount, owner)
    testlang.confirm_spend(spend_id_2, owner)

    proof = b'deadbeef'
    (input_index, encoded_spend, _, sigs, confirmation_sig) = testlang.get_challenge_proof(spend_id_1, spend_id_2)
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeExit(spend_id_1, input_index, encoded_spend, proof, sigs, confirmation_sig)


def test_challenge_exit_invalid_confirmation_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_blknum = testlang.deposit(owner, amount)
    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    spend_id_1 = testlang.spend_utxo(deposit_id, owner, amount, owner)
    testlang.confirm_spend(spend_id_1, owner)
    testlang.start_exit(owner, spend_id_1)
    spend_id_2 = testlang.spend_utxo(spend_id_1, owner, amount, owner)
    testlang.confirm_spend(spend_id_2, owner)

    confirmation_sig = b'deadbeef'
    (input_index, encoded_spend, proof, sigs, _) = testlang.get_challenge_proof(spend_id_1, spend_id_2)
    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeExit(spend_id_1, input_index, encoded_spend, proof, sigs, confirmation_sig)


'''
def test_finalize_exits(t, u, root_chain):
    two_weeks = 60 * 60 * 24 * 14
    owner, value_1, key = t.a1, 100, t.k1
    tx1 = Transaction(0, 0, 0, 0, 0, 0,
                      NULL_ADDRESS,
                      owner, value_1, NULL_ADDRESS, 0)
    dep1_blknum = root_chain.getDepositBlock()
    root_chain.deposit(value=value_1, sender=key)
    utxo_pos1 = dep1_blknum * 1000000000 + 10000 * 0 + 1
    root_chain.startDepositExit(utxo_pos1, NULL_ADDRESS, tx1.amount1, sender=key)
    t.chain.head_state.timestamp += two_weeks * 2
    assert root_chain.exits(utxo_pos1) == [address_to_hex(owner), NULL_ADDRESS_HEX, 100]
    pre_balance = t.chain.head_state.get_balance(owner)
    root_chain.finalizeExits(sender=t.k2)
    post_balance = t.chain.head_state.get_balance(owner)
    assert post_balance == pre_balance + value_1
    assert root_chain.exits(utxo_pos1) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, value_1]
'''
