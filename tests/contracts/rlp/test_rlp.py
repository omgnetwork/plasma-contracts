"""
Regression test for bug in RLP decoder.
"""

import pytest
import rlp

from eth_utils import encode_hex

from rlp.sedes import big_endian_int
from ethereum import utils


class Eight(rlp.Serializable):
    fields = [
        ('f0', big_endian_int),
        ('f1', big_endian_int),
        ('f2', big_endian_int),
        ('f3', big_endian_int),
        ('f4', big_endian_int),
        ('f5', big_endian_int),
        ('f6', utils.address),
        ('f7', utils.address)
    ]

    def __init__(self, f0, f1, f2, f3, f4, f5, f6, f7):
        self.f0 = f0
        self.f1 = f1
        self.f2 = f2
        self.f3 = f3
        self.f4 = f4
        self.f5 = f5
        self.f6 = f6
        self.f7 = f7


class Eleven(rlp.Serializable):
    fields = [
        ('f0', big_endian_int),
        ('f1', big_endian_int),
        ('f2', big_endian_int),
        ('f3', big_endian_int),
        ('f4', big_endian_int),
        ('f5', big_endian_int),
        ('f6', big_endian_int),
        ('f7', big_endian_int),
        ('f8', utils.address),
        ('f9', utils.address),
        ('f10', utils.address)
    ]

    def __init__(self, f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10):
        self.f0 = f0
        self.f1 = f1
        self.f2 = f2
        self.f3 = f3
        self.f4 = f4
        self.f5 = f5
        self.f6 = f6
        self.f7 = f7
        self.f8 = f8
        self.f9 = f9
        self.f10 = f10


@pytest.fixture
def rlp_test(ethtester, get_contract):
    contract = get_contract('RLPTest')
    ethtester.chain.mine()
    return contract


def test_rlp_tx_eight(ethtester, rlp_test):
    tx = Eight(0, 1, 2, 3, 4, 5, ethtester.a0, ethtester.a1)
    tx_bytes = rlp.encode(tx, Eight)
    assert [5, encode_hex(ethtester.a0), encode_hex(ethtester.a1)] == rlp_test.eight(tx_bytes)


def test_rlp_tx_eleven(ethtester, rlp_test):
    tx = Eleven(0, 1, 2, 3, 4, 5, 6, 7, ethtester.a0, ethtester.a1, ethtester.a2)
    tx_bytes = rlp.encode(tx, Eleven)
    assert [7, encode_hex(ethtester.a0), encode_hex(ethtester.a1), encode_hex(ethtester.a2)] == rlp_test.eleven(tx_bytes)
