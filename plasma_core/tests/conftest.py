import pytest
from ethereum.tools import tester


@pytest.fixture
def ethtester():
    tester.chain = tester.Chain()
    return tester
