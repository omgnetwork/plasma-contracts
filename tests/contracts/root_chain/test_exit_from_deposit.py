import pytest
from plasma_core.constants import NULL_ADDRESS_HEX
from ethereum.tools.tester import TransactionFailed
from testlang.testlang import address_to_hex


def test_start_deposit_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_deposit_exit(owner, deposit_id, 100)

    assert testlang.root_chain.exits(deposit_id) == [owner.address, NULL_ADDRESS_HEX, amount]


def test_start_deposit_exit_twice_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.start_deposit_exit(owner, deposit_id, 100)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, deposit_id, 100)


def test_start_deposit_exit_invalid_amount_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    testlang.child_chain.get_transaction(deposit_id)

    with pytest.raises(TransactionFailed):
        testlang.root_chain.startDepositExit(deposit_id, NULL_ADDRESS_HEX, 1000, sender=owner.key)


def test_start_deposit_exit_from_transaction_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)

    with pytest.raises(TransactionFailed):
        testlang.start_deposit_exit(owner, spend_id, 100)


def test_start_token_deposit_exit_should_succeed(testlang, token):
    owner, amount = testlang.accounts[0], 100
    testlang.root_chain.addToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)

    testlang.start_deposit_exit(owner, deposit_id, amount, token_addr=token.address)

    token_address_hex = address_to_hex(token.address)
    assert testlang.root_chain.exits(deposit_id) == [owner.address, token_address_hex, amount]
