pragma solidity ^0.5.0;
// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397 
pragma experimental ABIEncoderV2;

import "./ExitProcessor.sol";
import "./PlasmaFramework.sol";

contract MVPExitProcessor is ExitProcessor {
    PlasmaFramework parent;
    uint256 txType;

    constructor(address _parentContract, uint256 _txType) public {
        /** 
            Exit Game would call parent contract for:
            1. Access to storage. All state storage is in parent contract (for upgradeability). 
            2. Process the withdraw from plasma chain to root chain. See "PlasmaWallet.sol".
         */
        parent = PlasmaFramework(_parentContract);
        txType = _txType;
    }

    function isExitValid(bytes32 _exitId) external view returns (bool) {
        bytes32 keyExitValid = keccak256(abi.encodePacked(_exitId, "-isValid"));
        return parent.getBoolStorage(txType, keyExitValid);
    }

    function processExit(bytes32 _exitId) external {
        /**
            keyToken = concat(exitId, "-token");
            keyExitTo = concat(exitId, "-exitTo");
            keyAmount = concat(exitId, "-amount");

            token = parentContract.getAddressStorage(txType, keyToken);
            exitTo = parentContract.getAddressStorage(txType, keyExitTo);
            amount = parentContract.getAddressStorage(txType, keyAmount);

            parentContract.withdrawErc20(token, exitTo, amount);
         */
    }
}