def test_explicitly_mine_consecutive_blocks(w3, accounts):
    w3.eth.disable_auto_mine()

    latest_block = w3.eth.getBlock('latest')
    tx_hash = w3.eth.sendTransaction({'from': accounts[0].address, 'to': accounts[1].address, 'value': 100})

    # new block has not been automatically mined
    assert w3.eth.getBlock('latest') == latest_block

    # mine the pending tx
    w3.eth.mine()

    new_block = w3.eth.getBlock('latest')
    assert new_block.number == latest_block.number + 1
    assert new_block.timestamp == latest_block.timestamp + 1
    assert tx_hash in new_block.transactions


def test_auto_mine_transactions(w3, accounts):

    latest_block = w3.eth.getBlock('latest')
    tx_hash = w3.eth.sendTransaction({'from': accounts[0].address, 'to': accounts[1].address, 'value': 100})

    # new block has been automatically mined

    new_block = w3.eth.getBlock('latest')
    assert new_block.number == latest_block.number + 1
    assert new_block.timestamp == latest_block.timestamp + 1
    assert tx_hash in new_block.transactions
