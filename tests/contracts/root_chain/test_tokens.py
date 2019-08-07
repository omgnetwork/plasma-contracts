import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS


def test_token_adding(token, root_chain):
    assert not root_chain.hasToken(token.address)
    root_chain.addToken(token.address)
    assert root_chain.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        root_chain.addToken(token.address)


def test_token_adding_gas_cost(w3, root_chain):
    ADDRESS_A = b'\x00' * 19 + b'\x01'
    ADDRESS_B = b'\x00' * 19 + b'\x02'
    tx_hash = root_chain.addToken(ADDRESS_A)
    gas = w3.eth.getTransactionReceipt(tx_hash).gasUsed
    print("PriorityQueue first deployment costs {} gas".format(gas))
    tx_hash = root_chain.addToken(ADDRESS_B)
    gas = w3.eth.getTransactionReceipt(tx_hash).gasUsed
    print("PriorityQueue second deployment costs {} gas".format(gas))


def test_token_adding_eth_token_should_fail(root_chain):
    assert root_chain.hasToken(NULL_ADDRESS)
    with pytest.raises(TransactionFailed):
        root_chain.addToken(NULL_ADDRESS)
