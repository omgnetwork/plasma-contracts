pragma solidity 0.5.11;

library PaymentStandardExitRouterArgs {
    /**
     * @notice Wraps arguments for startStandardExit
     * @param utxoPos Position of the exiting output
     * @param rlpOutputTx The RLP-encoded transaction that creates the exiting output
     * @param outputTxInclusionProof A Merkle proof showing that the transaction was included
    */
    struct StartStandardExitArgs {
        uint256 utxoPos;
        bytes rlpOutputTx;
        bytes outputTxInclusionProof;
    }

    /**
     * @notice Input args data for challengeStandardExit
     * @param exitId Identifier of the standard exit to challenge
     * @param exitingTx RLP-encoded transaction that creates the exiting output
     * @param challengeTx RLP-encoded transaction that spends the exiting output
     * @param inputIndex Input of the challenging tx, corresponding to the exiting output
     * @param witness Witness data that proves the exiting output is spent
     * @param senderData A keccak256 hash of the sender's address
     */
    struct ChallengeStandardExitArgs {
        uint168 exitId;
        bytes exitingTx;
        bytes challengeTx;
        uint16 inputIndex;
        bytes witness;
        bytes32 senderData;
    }
}
