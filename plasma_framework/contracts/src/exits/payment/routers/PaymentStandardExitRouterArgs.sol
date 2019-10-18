pragma solidity 0.5.11;

library PaymentStandardExitRouterArgs {
    /**
     * @notice Wraps arguments for startStandardExit
     * @param utxoPos Position of the exiting output
     * @param rlpOutputTx The RLP-encoded transaction that creates the exiting output
     * @param outputGuardPreimage (Optional) Output guard preimage data
     * @param outputTxInclusionProof A Merkle proof showing that the transaction was included
    */
    struct StartStandardExitArgs {
        uint192 utxoPos;
        bytes rlpOutputTx;
        bytes outputGuardPreimage;
        bytes outputTxInclusionProof;
    }

    /**
     * @notice Input args data for challengeStandardExit
     * @param exitId Identifier of the standard exit to challenge
     * @param exitingTx RLP-encoded transaction that creates the exiting output
     * @param challengeTx RLP-encoded transaction that spends the exiting output
     * @param inputIndex Input of the challenging tx, corresponding to the exiting output
     * @param witness Witness data that proves the exiting output is spent
     * @param spendingConditionOptionalArgs (Optional) Additional data for the spending condition
     * @param outputGuardPreimage (Optional) The output guard preimage for the challenge tx to use the output
     * @param challengeTxPos (Optional) The position of a MVP protocol challenge tx
     * @param challengeTxInclusionProof (Optional) Provides inclusion proof for a MVP protocol challenge tx
     * @param challengeTxConfirmSig (Optional) Provides the confirm signature of a MVP protocol challenge tx
     */
    struct ChallengeStandardExitArgs {
        uint160 exitId;
        bytes exitingTx;
        bytes challengeTx;
        uint16 inputIndex;
        bytes witness;
        bytes spendingConditionOptionalArgs;
        bytes outputGuardPreimage;
        uint256 challengeTxPos;
        bytes challengeTxInclusionProof;
        bytes challengeTxConfirmSig;
    }
}
