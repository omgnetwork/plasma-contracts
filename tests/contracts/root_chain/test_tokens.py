import pytest
from eth_tester.exceptions import TransactionFailed
from plasma_core.constants import NULL_ADDRESS

pytestmark = pytest.mark.skip()


def test_token_adding(token, plasma_framework):
    assert not plasma_framework.hasToken(token.address)
    plasma_framework.addToken(token.address)
    assert plasma_framework.hasToken(token.address)
    with pytest.raises(TransactionFailed):
        plasma_framework.addToken(token.address)


def test_token_adding_gas_cost(w3, plasma_framework):
    ADDRESS_A = b'\x00' * 19 + b'\x01'
    ADDRESS_B = b'\x00' * 19 + b'\x02'
    tx_hash = plasma_framework.addToken(ADDRESS_A)
    gas = w3.eth.getTransactionReceipt(tx_hash).gasUsed
    print("PriorityQueue first deployment costs {} gas".format(gas))
    tx_hash = plasma_framework.addToken(ADDRESS_B)
    gas = w3.eth.getTransactionReceipt(tx_hash).gasUsed
    print("PriorityQueue second deployment costs {} gas".format(gas))


def test_token_adding_eth_token_should_fail(plasma_framework):
    assert plasma_framework.hasToken(NULL_ADDRESS)
    with pytest.raises(TransactionFailed):
        plasma_framework.addToken(NULL_ADDRESS)
