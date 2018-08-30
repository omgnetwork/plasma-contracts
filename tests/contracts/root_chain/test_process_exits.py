from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK
from eth_utils import encode_hex


def test_process_exits_standard_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)

    pre_balance = testlang.get_balance(owner)

    testlang.start_standard_exit(owner, spend_id)
    testlang.forward_timestamp(2 * WEEK + 1)

    testlang.finalize_exits(NULL_ADDRESS)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.token == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount
    assert testlang.get_balance(owner) == pre_balance + amount


def test_finalize_exits_for_ERC20_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)

    testlang.start_standard_exit(owner, spend_id)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.token == encode_hex(token.address)
    assert standard_exit.owner == owner.address
    testlang.forward_timestamp(2 * WEEK + 1)

    pre_balance = token.balanceOf(owner.address)
    testlang.finalize_exits(token.address)

    plasma_exit = testlang.get_standard_exit(spend_id)
    assert plasma_exit.token == encode_hex(token.address)
    assert plasma_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount
    assert token.balanceOf(owner.address) == pre_balance + amount


def test_finalize_exits_old_utxo_is_mature_after_single_mfp(testlang):
    minimal_finalization_period = WEEK  # aka MFP - see tesuji blockchain design
    required_exit_period = WEEK  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    testlang.forward_timestamp(required_exit_period)
    testlang.start_standard_exit(owner, spend_id)
    testlang.forward_timestamp(minimal_finalization_period)

    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.finalize_exits(NULL_ADDRESS)
    testlang.forward_timestamp(1)
    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.finalize_exits(NULL_ADDRESS)
    assert testlang.get_standard_exit(spend_id).owner == NULL_ADDRESS_HEX


def test_finalize_exits_new_utxo_is_mature_after_mfp_pls_rep(testlang):
    minimal_finalization_period = WEEK  # aka MFP - see tesuji blockchain design
    required_exit_period = WEEK  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id = testlang.deposit(owner, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id)

    testlang.forward_timestamp(required_exit_period)
    assert testlang.get_standard_exit(spend_id).owner == owner.address
    testlang.finalize_exits(NULL_ADDRESS)
    assert testlang.get_standard_exit(spend_id).owner == owner.address

    testlang.forward_timestamp(minimal_finalization_period + 1)
    testlang.finalize_exits(NULL_ADDRESS)
    assert testlang.get_standard_exit(spend_id).owner == NULL_ADDRESS_HEX


def test_finalize_exits_only_mature_exits_are_processed(testlang):
    minimal_finalization_period = WEEK  # aka MFP - see tesuji blockchain design
    required_exit_period = WEEK  # aka REP - see tesuji blockchain design
    owner, amount = testlang.accounts[0], 100

    deposit_id_1 = testlang.deposit(owner, amount)
    spend_id_1 = testlang.spend_utxo(deposit_id_1, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id_1)

    testlang.forward_timestamp(required_exit_period + minimal_finalization_period + 1)

    deposit_id_2 = testlang.deposit(owner, amount)
    spend_id_2 = testlang.spend_utxo(deposit_id_2, owner, amount, owner)

    testlang.start_standard_exit(owner, spend_id_2)

    assert testlang.get_standard_exit(spend_id_1).owner == owner.address
    assert testlang.get_standard_exit(spend_id_2).owner == owner.address
    testlang.finalize_exits(NULL_ADDRESS)
    assert testlang.get_standard_exit(spend_id_1).owner == NULL_ADDRESS_HEX
    assert testlang.get_standard_exit(spend_id_2).owner == owner.address
