pragma solidity ^0.5.0;
// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397 
pragma experimental ABIEncoderV2;


import "./ExitGame.sol";

/**
This defines exit game for ODEX funding tx.
Tx output can be exit to input owner but not output (exchange).
However, tx output can be used in ODEX batch settlement tx with exchange signature and correct order.
 */
contract OdexFundingTxExitGame is ExitGame {}

/**
This defines exit game for ODEX batch settlemet tx.
 */
contract OdexBatchSettlementTxExitGame is ExitGame {}
