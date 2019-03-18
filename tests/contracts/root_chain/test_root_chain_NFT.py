import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.utils.transactions import encode_utxo_id, decode_utxo_id
from plasma_core.utils.address import address_to_bytes
from plasma_core.constants import NULL_ADDRESS_HEX, WEEK


# deposit ERC721 token
def test_deposit_token(testlang, ethtester, root_chain, token_NFT):
    owner = testlang.accounts[0]

    deposit_id = testlang.deposit_token_nft(owner, token_NFT, [1,2,3,4,5,6,7,8])
    deposit_blknum, _, _ = decode_utxo_id(deposit_id)

    plasma_block = testlang.get_plasma_block(deposit_blknum)
    
    assert plasma_block.root == testlang.child_chain.get_block(deposit_blknum).root
    assert plasma_block.timestamp == testlang.timestamp
    assert root_chain.nextDepositBlock() == 2


# startExit
def test_start_exit_should_succeed(testlang, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)

    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    testlang.start_standard_exit(spend_id, owner.key)

    plasma_exit = testlang.get_standard_exit(spend_id)

    assert plasma_exit.owner == owner.address
    assert plasma_exit.token == '0x' + token_NFT.address.hex()
    assert plasma_exit.amount == 0
    # assert plasma_exit.token_ids == token_ids FIXME: implement returning struct with list


def test_start_exit_twice_should_fail(testlang, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)

    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    testlang.start_standard_exit(spend_id, owner.key)

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(spend_id, owner.key)


def test_start_exit_wrong_owner_should_fail(testlang, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)

    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit(spend_id, testlang.accounts[1].key)


def test_start_exit_spend_utxos_should_success(testlang, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)

    spend1_id = testlang.spend_utxo(
        [deposit_id],
        [owner.key],
        [(owner.address, token_NFT.address, [1, 3, 5]),
         (owner.address, token_NFT.address, [2, 4, 6, 7, 8])])

    testlang.start_standard_exit(spend1_id, owner.key)

    plasma_exit1 = testlang.get_standard_exit(spend1_id)

    assert plasma_exit1.owner == owner.address
    assert plasma_exit1.token == '0x' + token_NFT.address.hex()
    assert plasma_exit1.amount == 0
    # assert plasma_exit1.token_ids == [1, 3, 5] FIXME: implement returning struct with list

    blknum, txindex, _ = decode_utxo_id(spend1_id)
    spend2_id = encode_utxo_id(blknum, txindex, 1)

    testlang.start_standard_exit(spend2_id, owner.key)
    plasma_exit2 = testlang.get_standard_exit(spend2_id)

    assert plasma_exit2.owner == owner.address
    assert plasma_exit2.token == '0x' + token_NFT.address.hex()
    assert plasma_exit2.amount == 0
    # assert plasma_exit2.token_ids == [2, 4, 6, 7, 8] FIXME: implement returning struct with list


# challengeExit
def test_challenge_exit_should_succeed(testlang, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)


    spend_id_1 = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    testlang.start_standard_exit(spend_id_1, owner.key)

    spend_id_2 = testlang.spend_utxo([spend_id_1], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    plasma_exit_before = testlang.get_standard_exit(spend_id_1)
    assert plasma_exit_before.owner == owner.address

    testlang.challenge_standard_exit(spend_id_1, spend_id_2)

    plasma_exit = testlang.get_standard_exit(spend_id_1)
    assert plasma_exit.owner == NULL_ADDRESS_HEX


# def test_challenge_exit_invalid_proof_should_fail(testlang, root_chain, token_NFT):
#     root_chain.addToken(token_NFT.address)
#     assert root_chain.hasToken(token_NFT.address)
#
#     token_ids = [1, 2, 3, 4, 5, 6, 7, 8]
#
#     owner = testlang.accounts[0]
#     deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)
#
#     spend_id_1 = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])
#
#     testlang.start_standard_exit(spend_id_1, owner.key)
#
#     spend_id_2 = testlang.spend_utxo([spend_id_1], [owner.key], [(owner.address, token_NFT.address, token_ids)])
#
#     plasma_exit_before = testlang.get_standard_exit(spend_id_1)
#     assert plasma_exit_before.owner == owner.address
#
#     proof = b'deadbeef'
#     (input_index, encoded_spend, _, sigs) = testlang.get_challenge_proof(spend_id_1, spend_id_2)
#     with pytest.raises(TransactionFailed):
#         testlang.root_chain.challengeExit(spend_id_1, input_index, encoded_spend, proof, sigs)
#
#     plasma_exit = testlang.get_standard_exit(spend_id_1)
#     assert plasma_exit.owner == owner.address


# processExits for tokens
def test_finalize_exits_should_succeed(testlang, ethtester, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)

    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    testlang.start_standard_exit(spend_id, owner.key)

    testlang.forward_timestamp(2 * WEEK + 1)

    pre_balance = token_NFT.balanceOf(owner.address)
    testlang.process_exits(token_NFT.address, 0, 100)

    plasma_exit = testlang.get_standard_exit(spend_id)
    assert plasma_exit.owner == NULL_ADDRESS_HEX
    assert token_NFT.balanceOf(owner.address) == pre_balance + len(token_ids)

    for tid in token_ids:
        assert token_NFT.ownerOf(tid) == owner.address


def test_finalize_exits_too_early_should_success(testlang, ethtester, root_chain, token_NFT):
    root_chain.addToken(token_NFT.address)
    assert root_chain.hasToken(token_NFT.address)

    token_ids = [1, 2, 3, 4, 5, 6, 7, 8]

    owner = testlang.accounts[0]
    deposit_id = testlang.deposit_token_nft(owner, token_NFT, token_ids)

    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, token_NFT.address, token_ids)])

    testlang.start_standard_exit(spend_id, owner.key)

    testlang.forward_timestamp(1 * WEEK + 1)

    pre_balance = token_NFT.balanceOf(owner.address)
    testlang.process_exits(token_NFT.address, 0, 100)

    plasma_exit = testlang.get_standard_exit(spend_id)
    assert plasma_exit.owner == owner.address
    assert token_NFT.balanceOf(owner.address) == pre_balance

    for tid in token_ids:
        assert token_NFT.ownerOf(tid) == "0x" + root_chain.address.hex()
