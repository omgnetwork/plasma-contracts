pragma solidity ^0.5.0;

import "./ZeroHashesProvider.sol";
import "../framework/BlockController.sol";
import "../framework/utils/Operated.sol";

contract Vault is Operated {
    BlockController blockController;
    bytes32[16] zeroHashes;

    constructor(address _blockController) public {
        blockController = BlockController(_blockController);
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    modifier onlyFromExitGame() {
        require(false, "TODO: Implement and test once we have exit plasma framework contract");
        _;
    }

    function _submitDepositBlock(bytes memory _depositTx) internal {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        blockController.submitDepositBlock(root);
    }
}
