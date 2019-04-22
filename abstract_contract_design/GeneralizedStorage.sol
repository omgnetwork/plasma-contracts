pragma solidity ^0.5.0;

import "./PlasmaStorage.sol";
import "./ExitGameRegistry.sol";

/**
Use a generalized storage in plasma for all exit games to call.
TODO: all the getter, setter and deleter functions. Provide some basic sample only here.
See PlasmaStorage.sol for all gernalized storage map that need the functions.
 */
contract GeneralizedStorage is ExitGameRegistry, PlasmaStorage {

    function getBoolStorage(uint256 _txType, bytes32 _key) external view returns (bool) {
        require(msg.sender == getExitGameContract(_txType));
        bytes32 key = keccak256(abi.encodePacked(_txType, _key));
        return boolStorage[key];
    }

    function setBoolStorage(uint256 _txType, bytes32 _key, bool _value) external {
        require(msg.sender == getExitGameContract(_txType));
        bytes32 key = keccak256(abi.encodePacked(_txType, _key));
        boolStorage[key] = _value;
    }

    function deleteBoolStorage(uint256 _txType, bytes32 _key) external {
        require(msg.sender == getExitGameContract(_txType));
        bytes32 key = keccak256(abi.encodePacked(_txType, _key));
        delete boolStorage[key];
    }
}