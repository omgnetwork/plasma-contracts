import math
import pytest
from eth_utils import keccak as sha3

from plasma_core.utils.merkle.fixed_merkle import FixedMerkle
from plasma_core.constants import NULL_HASH

LEAF_SALT = b'\x00'
NODE_SALT = b'\x01'


def get_empty_tree_hash(depth):
    root = sha3(NULL_HASH)
    for _ in range(depth):
        root = sha3(NODE_SALT + root + root)
    return root


@pytest.mark.parametrize("depth", [2, 3, 12])
def test_initial_state(depth):
    assert FixedMerkle(depth).leaves == [sha3(NULL_HASH)] * (2 ** depth)


@pytest.mark.parametrize("num_leaves", [3, 5, 9])
def test_initialize_with_leaves(num_leaves):
    depth = math.ceil(math.log(num_leaves, 2))
    leaves = [b'asdf'] * num_leaves

    hashed_leaves = [sha3(LEAF_SALT + leaf) for leaf in leaves]
    empty_leaves = [sha3(NULL_HASH)] * (2 ** depth - num_leaves)

    assert FixedMerkle(depth, leaves).leaves == hashed_leaves + empty_leaves


def test_initialize_with_too_many_leaves():
    depth = 1
    leaves = [b'asdf'] * (2 ** depth + 1)

    with pytest.raises(ValueError) as e:
        FixedMerkle(depth, leaves)

    assert str(e.value) == 'number of leaves should be at most depth ** 2'


@pytest.mark.parametrize("depth", [1, 2, 16])
def test_empty_tree(depth):
    assert FixedMerkle(depth).root == get_empty_tree_hash(depth)


def test_create_membership_proof():
    leaf = b'c'
    leaves = [b'a', b'b', leaf]
    proof = FixedMerkle(2, leaves).create_membership_proof(leaf)
    leaf_hash = sha3(LEAF_SALT + leaf)
    node_hash_1 = sha3(NODE_SALT + sha3(LEAF_SALT + leaves[0]) + sha3(LEAF_SALT + leaves[1]))
    node_hash_2 = sha3(NODE_SALT + leaf_hash + sha3(NULL_HASH))
    root_hash = sha3(NODE_SALT + node_hash_1 + node_hash_2)
    assert proof == leaf_hash + node_hash_2 + root_hash


def test_check_membership():
    leaves = [b'a', b'b', b'c']
    merkle = FixedMerkle(2, leaves)
    proof = merkle.create_membership_proof(leaves[2])
    assert merkle.check_membership(leaves[2], 2, proof)
