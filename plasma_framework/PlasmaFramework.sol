pragma solidity ^0.4.0;

import "./Operated.sol";
import "./PlasmaBlockController.sol";
import "./PlasmaWallet.sol";
import "./ExitGameRegistry.sol";
import "./ExitGameController.sol";

// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397
pragma experimental ABIEncoderV2;

//
//import "./GeneralizedStorage.sol";
//import "./PlasmaWallet.sol";
//import "./ExitGameController.sol";
//import "./TxOutputPredicateRegistry.sol";



//contract PlasmaFramework is PlasmaBlockController, PlasmaWallet, ExitGameController, TxOutputPredicateRegistry, GeneralizedStorage {
//
//}

contract PlasmaFramework is PlasmaBlockController, PlasmaWallet, ExitGameController {

}