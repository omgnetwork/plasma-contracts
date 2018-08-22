import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.utils.address import address_to_bytes
from plasma_core.utils.utils import get_deposit_hash
from plasma_core.constants import NULL_ADDRESS
from plasma_core.utils.transactions import decode_utxo_id


def test_deposit_valid_values_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), NULL_ADDRESS, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.currentDepositBlock() == 2


def test_token_adding(token, root_chain):
    assert not root_chain.hasToken(token.address)
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        root_chain.addToken(token.address)


def test_token_deposit_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit_token(owner, token, amount)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    assert plasma_block.root == get_deposit_hash(address_to_bytes(owner.address), token.address, amount)
    assert plasma_block.timestamp == testlang.timestamp
    assert testlang.root_chain.currentDepositBlock() == 2
