import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.utils.transactions import encode_utxo_id
from plasma_core.utils.address import address_to_bytes
from plasma_core.utils.utils import get_deposit_hash
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK


# add token
def test_token_adding(ethtester, token, root_chain):
    assert not root_chain.hasToken(token.address)
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        root_chain.addToken(token.address)


# deposit
def test_deposit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_blknum = testlang.deposit(owner, amount)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), NULL_ADDRESS, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.currentDepositBlock() == 2


# deposit ERC20 token
def test_deposit_token(testlang, ethtester, root_chain, token):
    owner, amount = testlang.accounts[0], 100

    deposit_blknum = testlang.deposit_token(owner, token, amount)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), token.address, amount)
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


# finalizeExits
def test_finalize_exits_should_succeed(testlang):
    owner, amount = testlang.accounts[1], 100
    deposit_blknum = testlang.deposit(owner, amount)
    testlang.start_deposit_exit(owner, deposit_blknum, amount)
    testlang.forward_timestamp(2 * WEEK + 1)

    pre_balance = testlang.get_balance(owner)
    testlang.finalize_exits()

    deposit_id = encode_utxo_id(deposit_blknum, 0, 0)
    plasma_exit = testlang.get_plasma_exit(deposit_id)
    assert plasma_exit.owner == NULL_ADDRESS_HEX
    assert testlang.get_balance(owner) == pre_balance + amount
