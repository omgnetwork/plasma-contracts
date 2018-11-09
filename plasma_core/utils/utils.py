from ethereum import utils as u
from plasma_core.constants import NULL_HASH
from plasma_core.utils.merkle.fixed_merkle import FixedMerkle


def get_empty_merkle_tree_hash(depth):
    zeroes_hash = NULL_HASH
    for _ in range(depth):
        zeroes_hash = u.sha3(zeroes_hash + zeroes_hash)
    return zeroes_hash


def get_merkle_of_leaves(depth, leaves):
    return FixedMerkle(depth, leaves)


def bytes_fill_left(inp, length):
    return bytes(length - len(inp)) + inp
