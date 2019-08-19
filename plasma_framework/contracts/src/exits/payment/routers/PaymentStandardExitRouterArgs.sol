pragma solidity ^0.5.0;

library PaymentStandardExitRouterArgs {
    /**
     * @notice Wraps arguments for startStandardExit.
     * @param _utxoPos Position of the exiting output.
     * @param _rlpOutputTx RLP encoded transaction that created the exiting output.
     * @param _outputType Specific type of the output.
     * @param _outputGuardData (Optional) Output guard data if the output type is not 0.
     * @param _outputTxInclusionProof A Merkle proof showing that the transaction was included.
    */
    struct StartStandardExitArgs {
        uint192 utxoPos;
        bytes rlpOutputTx;
        uint256 outputType;
        bytes outputGuardData;
        bytes outputTxInclusionProof;
    }
}
