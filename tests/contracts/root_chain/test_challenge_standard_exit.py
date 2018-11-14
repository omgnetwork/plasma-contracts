import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK


def test_challenge_standard_exit_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner.key)
    doublespend_id = testlang.spend_utxo([spend_id], [owner.key], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.challenge_standard_exit(spend_id, doublespend_id)

    assert testlang.root_chain.exits(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]


def test_challenge_standard_exit_mature_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner.key)
    doublespend_id = testlang.spend_utxo([spend_id], [owner.key], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.forward_timestamp(2 * WEEK + 1)

    testlang.challenge_standard_exit(spend_id, doublespend_id)

    assert testlang.root_chain.exits(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]


def test_challenge_standard_exit_invalid_spend_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    testlang.start_standard_exit(deposit_id, owner_1.key)
    spend_id = testlang.spend_utxo([deposit_id], [owner_2.key], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)


def test_challenge_standard_exit_unrelated_spend_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id_1 = testlang.deposit(owner, amount)
    testlang.start_standard_exit(deposit_id_1, owner.key)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id_2], [owner.key])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id_1, spend_id)


def test_challenge_standard_exit_not_started_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)


def test_challenge_standard_exit_wrong_oindex_should_fail(testlang):
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

    testlang.start_standard_exit(alice_utxo, alice.key)

    bob_spend_id = testlang.spend_utxo([bob_utxo], [bob.key], outputs=[(bob.address, NULL_ADDRESS, bob_money)])
    alice_spend_id = testlang.spend_utxo([alice_utxo], [alice.key], outputs=[(alice.address, NULL_ADDRESS, alice_money)])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(alice_utxo, bob_spend_id)

    testlang.challenge_standard_exit(alice_utxo, alice_spend_id)
