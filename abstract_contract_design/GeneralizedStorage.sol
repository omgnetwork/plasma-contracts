pragma solidity ^0.5.0;

import "./PlasmaStorage.sol";
import "./ExitGameRegistrator.sol";

/**
Use a generalized storage in plasma for all exit games to call.
TODO: all the getter, setter and deleter functions. Provide some basic sample only here.
See PlasmaStorage.sol for all gernalized storage map that need the functions.
 */
contract GeneralizedStorage is ExitGameRegistrator, PlasmaStorage {

    function getAddress(bytes32 _exitGame, bytes32 _key) external view returns (address) {
        require(msg.sender == getExitGameContract(_exitGame));
        bytes32 key = keccak256(abi.encodePacked(_exitGame, _key));
        return addressStorage[key];
    }

    function setAddress(bytes32 _exitGame, bytes32 _key, address _value) external {
        require(msg.sender == getExitGameContract(_exitGame));
        bytes32 key = keccak256(abi.encodePacked(_exitGame, _key));
        addressStorage[key] = _value;
    }

    function deleteAddress(bytes32 _exitGame, bytes32 _key) external {
        require(msg.sender == getExitGameContract(_exitGame));
        bytes32 key = keccak256(abi.encodePacked(_exitGame, _key));
        delete addressStorage[key];
    }
}