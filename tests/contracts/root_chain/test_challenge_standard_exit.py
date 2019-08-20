import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, MIN_EXIT_PERIOD, NULL_SIGNATURE
from plasma_core.transaction import Transaction
from plasma_core.utils.transactions import decode_utxo_id

pytestmark = pytest.mark.skip()


def test_challenge_standard_exit_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner)
    doublespend_id = testlang.spend_utxo([spend_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])
    testlang.challenge_standard_exit(spend_id, doublespend_id)

    assert testlang.get_standard_exit(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]


def test_challenge_standard_exit_if_successful_awards_the_bond(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner)
    doublespend_id = testlang.spend_utxo([spend_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    pre_balance = testlang.get_balance(owner)
    testlang.challenge_standard_exit(spend_id, doublespend_id)
    post_balance = testlang.get_balance(owner)
    assert post_balance > pre_balance


def test_challenge_standard_exit_mature_valid_spend_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.start_standard_exit(spend_id, owner)
    doublespend_id = testlang.spend_utxo([spend_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    testlang.forward_timestamp(2 * MIN_EXIT_PERIOD + 1)

    testlang.challenge_standard_exit(spend_id, doublespend_id)
    assert testlang.get_standard_exit(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0]


def test_challenge_standard_exit_invalid_spend_should_fail(testlang):
    owner_1, owner_2, amount = testlang.accounts[0], testlang.accounts[1], 100
    deposit_id = testlang.deposit(owner_1, amount)
    testlang.start_standard_exit(deposit_id, owner_1)
    spend_id = testlang.spend_utxo([deposit_id], [owner_2], force_invalid=True)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)


def test_challenge_standard_exit_unrelated_spend_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id_1 = testlang.deposit(owner, amount)
    testlang.start_standard_exit(deposit_id_1, owner)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id_2], [owner])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id_1, spend_id)


def test_challenge_standard_exit_uninitialized_memory_and_zero_sig_should_fail(testlang):
    bond = testlang.root_chain.standardExitBond()
    owner, amount = testlang.accounts[0], 100 * bond
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner])
    tx = testlang.child_chain.get_transaction(spend_id)

    with pytest.raises(TransactionFailed):
        testlang.root_chain.challengeStandardExit(0, tx.encoded, 3, NULL_SIGNATURE)


def test_challenge_standard_exit_not_started_should_fail(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(deposit_id, spend_id)


def test_challenge_standard_exit_wrong_oindex_should_fail(testlang):
    from plasma_core.utils.transactions import decode_utxo_id, encode_utxo_id
    from plasma_core.transaction import Transaction
    alice, bob, alice_money, bob_money = testlang.accounts[0], testlang.accounts[1], 10, 90

    deposit_id = testlang.deposit(alice, alice_money + bob_money)
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    spend_tx = Transaction(inputs=[decode_utxo_id(deposit_id)],
                           outputs=[(alice.address, NULL_ADDRESS, alice_money), (bob.address, NULL_ADDRESS, bob_money)])
    spend_tx.sign(0, alice, verifyingContract=testlang.root_chain)
    blknum = testlang.submit_block([spend_tx])
    alice_utxo = encode_utxo_id(blknum, 0, 0)
    bob_utxo = encode_utxo_id(blknum, 0, 1)

    testlang.start_standard_exit(alice_utxo, alice)
    testlang.start_standard_exit(bob_utxo, bob)

    bob_spend_id = testlang.spend_utxo([bob_utxo], [bob], outputs=[(bob.address, NULL_ADDRESS, bob_money)])
    alice_spend_id = testlang.spend_utxo([alice_utxo], [alice], outputs=[(alice.address, NULL_ADDRESS, alice_money)])

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(alice_utxo, bob_spend_id)

    with pytest.raises(TransactionFailed):
        testlang.challenge_standard_exit(bob_utxo, alice_spend_id)

    testlang.challenge_standard_exit(alice_utxo, alice_spend_id)


def test_challenge_standard_exit_with_in_flight_exit_tx_should_succeed(testlang):
    # exit cross-spend test, cases 3 and 4
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner], outputs=[(owner.address, NULL_ADDRESS, amount)])

    ife_tx = Transaction(inputs=[decode_utxo_id(spend_id)], outputs=[(owner.address, NULL_ADDRESS, amount)])
    ife_tx.sign(0, owner, verifyingContract=testlang.root_chain)

    (encoded_spend, encoded_inputs, proofs, signatures) = testlang.get_in_flight_exit_info(None, spend_tx=ife_tx)
    bond = testlang.root_chain.inFlightExitBond()
    testlang.root_chain.startInFlightExit(encoded_spend, encoded_inputs, proofs, signatures,
                                          **{'value': bond, 'from': owner.address})

    testlang.start_standard_exit(spend_id, owner)
    assert testlang.get_standard_exit(spend_id).amount == 100

    exit_id = testlang.get_standard_exit_id(spend_id)
    # FIXME a proper way of getting encoded body of IFE tx is to get it out of generated events
    testlang.root_chain.challengeStandardExit(exit_id, ife_tx.encoded, 0, ife_tx.signatures[0])

    assert testlang.get_standard_exit(spend_id) == [NULL_ADDRESS_HEX, NULL_ADDRESS_HEX, 0, 0]
