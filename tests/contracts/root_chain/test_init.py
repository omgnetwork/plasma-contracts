import pytest
from ethereum.tools.tester import TransactionFailed


def test_cant_ever_init_twice(ethtester, root_chain):
    ethtester.chain.mine()
    with pytest.raises(TransactionFailed):
        root_chain.init(sender=ethtester.k0)

    with pytest.raises(TransactionFailed):
        root_chain.init(sender=ethtester.k1)
