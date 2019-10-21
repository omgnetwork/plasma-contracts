import math
import pytest
from eth_utils import keccak as sha3

from plasma_core.utils.merkle.fixed_merkle import FixedMerkle
from plasma_core.constants import NULL_HASH


def get_empty_tree_hash(depth):
    root = sha3(NULL_HASH)
    for _ in range(depth):
        root = sha3(root + root)
    return root


@pytest.mark.parametrize("depth", [2, 3, 12])
def test_initial_state(depth):
    assert FixedMerkle(depth).leaves == [sha3(NULL_HASH)] * (2 ** depth)


@pytest.mark.parametrize("num_leaves", [3, 5, 9])
def test_initialize_with_leaves(num_leaves):
    depth = math.ceil(math.log(num_leaves, 2))
    leaves = [b'asdf'] * num_leaves

    hashed_leaves = [sha3(leaf) for leaf in leaves]
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
    leaves = [b'a', b'b', b'c']
    proof = FixedMerkle(2, leaves).create_membership_proof(leaves[2])
    assert proof == sha3(NULL_HASH) + sha3(sha3(leaves[0]) + sha3(leaves[1]))


def test_check_membership():
    leaves = [b'a', b'b', b'c']
    merkle = FixedMerkle(2, leaves)
    proof = merkle.create_membership_proof(leaves[2])
    assert merkle.check_membership(leaves[2], 2, proof)
