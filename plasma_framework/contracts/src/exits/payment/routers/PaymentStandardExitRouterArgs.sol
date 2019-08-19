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

    /**
     * @notice Input args data for challengeStandardExit.
     * @param exitId Identifier of the standard exit to challenge.
     * @param outputType The output type of the exiting output.
     * @param outputGuard The output guard of the output.
     * @param challengeTxType The tx type of the challenge transaction.
     * @param challengeTx RLP encoded transaction that spends the exiting output.
     * @param inputIndex Which input of the challenging tx corresponds to the exiting output.
     * @param witness Witness data that can prove the exiting output is spent.
     */
    struct ChallengeStandardExitArgs {
        uint192 exitId;
        uint256 outputType;
        bytes32 outputGuard;
        uint256 challengeTxType;
        bytes challengeTx;
        uint8 inputIndex;
        bytes witness;
    }
}
