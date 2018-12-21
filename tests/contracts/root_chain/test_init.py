import pytest
from ethereum.tools.tester import TransactionFailed


def test_cant_ever_init_twice(ethtester, get_contract):
    root_chain = get_contract('RootChain')
    ethtester.chain.mine()
    root_chain.init(sender=ethtester.k1)
    ethtester.chain.mine()

    with pytest.raises(TransactionFailed):
        root_chain.init(sender=ethtester.k1)

    ethtester.chain.mine()
    with pytest.raises(TransactionFailed):
        root_chain.init(sender=ethtester.k2)
