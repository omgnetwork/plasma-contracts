from plasma_core.constants import NULL_ADDRESS, NULL_ADDRESS_HEX, WEEK
from eth_utils import encode_hex


def test_process_exits_standard_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

    testlang.start_standard_exit(owner, spend_id)
    testlang.forward_timestamp(2 * WEEK + 1)

    testlang.finalize_exits(NULL_ADDRESS)

    standard_exit = testlang.get_standard_exit(spend_id)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.token == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount


def test_finalize_exits_for_ERC20_should_succeed(testlang, root_chain, token):
    owner, amount = testlang.accounts[0], 100
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    deposit_id = testlang.deposit_token(owner, token, amount)
    spend_id = testlang.spend_utxo(deposit_id, owner, 100, owner)
    testlang.confirm_spend(spend_id, owner)

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
