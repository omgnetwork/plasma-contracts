from eth_utils import keccak as sha3
from .exceptions import MemberNotExistException
from plasma_core.constants import NULL_HASH


class MerkleNode(object):

    def __init__(self, data, left=None, right=None):
        self.data = data
        self.left = left
        self.right = right


class FixedMerkle(object):

    def __init__(self, depth, leaves=[]):
        if depth < 1:
            raise ValueError('depth must be at least 1')

        self.depth = depth
        self.leaf_count = 2 ** depth

        if len(leaves) > self.leaf_count:
            raise ValueError('number of leaves should be at most depth ** 2')

        leaves = [sha3(leaf) for leaf in leaves]

        self.leaves = leaves + [sha3(NULL_HASH)] * (self.leaf_count - len(leaves))
        self.tree = [self.__create_nodes(self.leaves)]
        self.__create_tree(self.tree[0])

    def __create_nodes(self, leaves):
        return [MerkleNode(leaf) for leaf in leaves]

    def __create_tree(self, leaves):
        if len(leaves) == 1:
            self.root = leaves[0].data
            return

        next_level = len(leaves)
        tree_level = []

        for i in range(0, next_level, 2):
            combined = sha3(leaves[i].data + leaves[i + 1].data)
            next_node = MerkleNode(combined, leaves[i], leaves[i + 1])
            tree_level.append(next_node)

        self.tree.append(tree_level)
        self.__create_tree(tree_level)

    def check_membership(self, leaf, index, proof):
        hashed_leaf = sha3(leaf)
        computed_hash = hashed_leaf
        computed_index = index

        for i in range(0, self.depth * 32, 32):
            proof_segment = proof[i:i + 32]

            if computed_index % 2 == 0:
                computed_hash = sha3(computed_hash + proof_segment)
            else:
                computed_hash = sha3(proof_segment + computed_hash)
            computed_index = computed_index // 2

        return computed_hash == self.root

    def create_membership_proof(self, leaf):
        hashed_leaf = sha3(leaf)
        if not self.__is_member(hashed_leaf):
            raise MemberNotExistException('leaf is not in the merkle tree')

        index = self.leaves.index(hashed_leaf)
        proof = b''

        for i in range(0, self.depth, 1):
            if index % 2 == 0:
                sibling_index = index + 1
            else:
                sibling_index = index - 1
            index = index // 2

            proof += self.tree[i][sibling_index].data

        return proof

    def __is_member(self, leaf):
        return leaf in self.leaves
