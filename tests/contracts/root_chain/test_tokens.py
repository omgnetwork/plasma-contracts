import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS


def test_token_adding(token, root_chain):
    assert not root_chain.hasToken(token.address)
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        root_chain.addToken(token.address)


def test_token_adding_gas_cost(ethtester, root_chain):
    ADDRESS_A = b'\x00' * 19 + b'\x01'
    ADDRESS_B = b'\x00' * 19 + b'\x02'
    root_chain.addToken(ADDRESS_A)
    gas = ethtester.chain.last_gas_used()
    print("PriorityQueue first deployment costs {} gas".format(gas))
    root_chain.addToken(ADDRESS_B)
    gas = ethtester.chain.last_gas_used()
    print("PriorityQueue second deployment costs {} gas".format(gas))


def test_token_adding_eth_token_should_fail(root_chain):
    assert root_chain.hasToken(NULL_ADDRESS)
    with pytest.raises(TransactionFailed):
        root_chain.addToken(NULL_ADDRESS)
