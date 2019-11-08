const NullHash = web3.utils.sha3('\0'.repeat(32));
const LeafSalt = '0x00';
const NodeSalt = '0x01';


class MerkleNode {
    constructor(data, left = null, right = null) {
        this.data = data;
        this.left = left;
        this.right = right;
    }
}

class MerkleTree {
    constructor(leaves, height = 0) {
        const minHeightForLeaves = parseInt(Math.log2(leaves.length), 10) + 1;

        if (height === 0) {
            this.height = minHeightForLeaves;
        } else if (height > minHeightForLeaves) {
            this.height = height;
        } else {
            throw new Error(
                `height should be at least ${minHeightForLeaves} for the list of leaves`,
            );
        }

        this.leafCount = 2 ** this.height;

        this.leaves = leaves.map(MerkleTree.hashLeaf);

        const fill = Array.from({ length: this.leafCount - this.leaves.length }, () => NullHash);
        this.leaves = this.leaves.concat(fill);
        this.tree = [MerkleTree.createNodes(this.leaves)];
        this.root = this.createTree(this.tree[0]);
    }

    static hashLeaf(leaf) {
        return web3.utils.sha3(LeafSalt + leaf.slice(2));
    }

    static createNodes(leaves) {
        return leaves.map(leaf => new MerkleNode(leaf));
    }

    createTree(level) {
        if (level.length === 1) {
            return level[0].data;
        }

        const levelSize = level.length;
        const nextLevel = [];

        let i = 0;
        while (i < levelSize) {
            // JS stores hashes as hex-encoded strings
            const combinedData = NodeSalt + level[i].data.slice(2) + level[i + 1].data.slice(2);
            const combined = web3.utils.sha3(web3.utils.hexToBytes(combinedData));
            const nextNode = new MerkleNode(combined, level[i], level[i + 1]);
            nextLevel.push(nextNode);
            i += 2;
        }

        this.tree.push(nextLevel);
        return this.createTree(nextLevel);
    }

    getInclusionProof(leaf) {
        const hashedLeaf = MerkleTree.hashLeaf(leaf);

        let index = this.leaves.indexOf(hashedLeaf);
        if (index === -1) {
            throw new Error('Argument is not a leaf in the tree');
        }

        let proof = '0x';
        for (let i = 0; i < this.height; i++) {
            let siblingIndex;
            if (index % 2 === 0) {
                siblingIndex = index + 1;
            } else {
                siblingIndex = index - 1;
            }
            index = Math.floor(index / 2);

            proof += this.tree[i][siblingIndex].data.slice(2);
        }

        return proof;
    }
}

module.exports.MerkleTree = MerkleTree;
