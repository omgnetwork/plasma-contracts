pragma solidity ^0.5.0;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import "../framework/utils/Operated.sol";

contract Vault is Operated {
    PlasmaFramework framework;
    bytes32[16] zeroHashes;

    constructor(PlasmaFramework _framework) public {
        framework = _framework;
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    modifier onlyFromExitGame() {
        require(
            framework.exitGameToTxType(msg.sender) != 0,
            "Not called from a registered Exit Game contract"
        );
        _;
    }

    function _submitDepositBlock(bytes memory _depositTx) internal {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        framework.submitDepositBlock(root);
    }
}
