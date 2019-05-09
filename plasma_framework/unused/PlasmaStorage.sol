pragma solidity ^0.4.0;

import "./ExitModel.sol";

/**
Centralized place to hold all Plasma storages.
If we want to use proxy contract upgrade on the plasma layer,
we need to make the the order of storage declaration can be only appended.
Put everything in a centralized place to avoid possible future crash.
 */
contract PlasmaStorage {
    /**
    Generalize storage
     */
    mapping(bytes32 => uint256) internal uIntStorage;
    mapping(bytes32 => string) internal stringStorage;
    mapping(bytes32 => address) internal addressStorage;
    mapping(bytes32 => bytes) internal bytesStorage;
    mapping(bytes32 => bool) internal boolStorage;
    mapping(bytes32 => int256) internal intStorage;

    /**
    Exit Game Controller
     */
    uint256 internal exitQueueNonce;
    mapping(uint256 => ExitModel.Exit) internal exits;

    /**
    Exit Game Registry
     */
    mapping(bytes32 => address) private games;
}