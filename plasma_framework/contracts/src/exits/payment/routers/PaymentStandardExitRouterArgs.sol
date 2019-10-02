pragma solidity 0.5.11;

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
     * @param exitingTx The transaction that is exiting.
     * @param challengeTx RLP encoded transaction that spends the exiting output.
     * @param inputIndex Which input of the challenging tx corresponds to the exiting output.
     * @param witness Witness data that can prove the exiting output is spent.
     * @param spendingConditionOptionalArgs optional extra data for the spending condition.
     * @param outputGuardPreimage (Optional) output guard preimage for the challenge tx to use the output
     * @param challengeTxPos (Optional) tx position of the challenge tx if it is of MVP protocol.
     * @param challengeTxInclusionProof (Optional) if the challenge tx is of MVP protocol provide the inclusion proof of it
     * @param challengeTxConfirmSig (Optional) if the challenge tx is of MVP protocol provide the confirm sig of it
     */
    struct ChallengeStandardExitArgs {
        uint160 exitId;
        uint256 outputType;
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
