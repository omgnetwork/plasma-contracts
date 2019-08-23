pragma solidity ^0.5.0;

library PaymentStandardExitRouterArgs {
    /**
     * @notice Wraps arguments for startStandardExit.
     * @param utxoPos Position of the exiting output.
     * @param rlpOutputTx RLP encoded transaction that created the exiting output.
     * @param outputType Specific type of the output.
     * @param outputGuardPreimage Output guard preimage data. (output type excluded)
     * @param outputTxInclusionProof A Merkle proof showing that the transaction was included.
    */
    struct StartStandardExitArgs {
        uint192 utxoPos;
        bytes rlpOutputTx;
        uint256 outputType;
        bytes outputGuardPreimage;
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
