pragma solidity ^0.5.0;

// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397 
pragma experimental ABIEncoderV2;


import "./GeneralizedStorage.sol";
import "./PlasmaWallet.sol";
import "./ExitGameController.sol";
import "./TxOutputPredicateRegistry.sol";

contract PlasmaBlockContoller {
    function submitBlock(bytes32 _blockRoot) public;
}

contract PlasmaFramework is PlasmaBlockContoller, PlasmaWallet, ExitGameController, TxOutputPredicateRegistry, GeneralizedStorage {
}