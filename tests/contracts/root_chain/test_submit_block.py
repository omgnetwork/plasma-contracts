import pytest
from ethereum.tools.tester import TransactionFailed


def test_submit_block_valid_key_should_succeed(ethtester, testlang):
    submitter = testlang.accounts[0]
    blknum = testlang.submit_block([], submitter)

    plasma_block = testlang.get_plasma_block(blknum)
    assert plasma_block.root == testlang.blocks[blknum].root
    assert plasma_block.timestamp == ethtester.chain.head_state.timestamp
    assert testlang.root_chain.nextChildBlock() == blknum + testlang.root_chain.CHILD_BLOCK_INTERVAL()


def test_submit_block_invalid_key_should_fail(testlang):
    submitter = testlang.accounts[1]

    with pytest.raises(TransactionFailed):
        testlang.submit_block([], submitter)
