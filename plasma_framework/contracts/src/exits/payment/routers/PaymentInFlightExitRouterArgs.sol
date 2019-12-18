pragma solidity 0.5.11;

library PaymentInFlightExitRouterArgs {
    /**
    * @notice Wraps arguments for startInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputTxs Transactions that created the inputs to the in-flight transaction. In the same order as in-flight transaction inputs.
    * @param inputUtxosPos Utxos that represent in-flight transaction inputs. In the same order as input transactions.
    * @param inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid. In the same order as input transactions.
    * @param inFlightTxWitnesses Witnesses for in-flight transaction. In the same order as input transactions.
    */
    struct StartExitArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputUtxosPos;
        bytes[] inputTxsInclusionProofs;
        bytes[] inFlightTxWitnesses;
    }

    /**
    * @notice Wraps arguments for piggybacking on in-flight transaction input exit
    * @param inFlightTx RLP-encoded in-flight transaction
    * @param inputIndex Index of the input to piggyback on
    */
    struct PiggybackInFlightExitOnInputArgs {
        bytes inFlightTx;
        uint16 inputIndex;
    }

    /**
    * @notice Wraps arguments for piggybacking on in-flight transaction output exit
    * @param inFlightTx RLP-encoded in-flight transaction
    * @param outputIndex Index of the output to piggyback on
    */
    struct PiggybackInFlightExitOnOutputArgs {
        bytes inFlightTx;
        uint16 outputIndex;
    }

    /**
     * @notice Wraps arguments for challenging non-canonical in-flight exits
     * @param inputTx Transaction that created shared input
     * @param inputUtxoPos Position of input utxo
     * @param inFlightTx RLP-encoded in-flight transaction
     * @param inFlightTxInputIndex Index of shared input for transactions in flight
     * @param competingTx RLP-encoded competing transaction
     * @param competingTxInputIndex Index of shared input in competing transaction
     * @param competingTxPos (Optional) Position of competing transaction in the chain, if included
     * @param competingTxInclusionProof (Optional) Merkle proofs showing that the competing transaction was contained in chain
     * @param competingTxWitness Witness for competing transaction
     */
    struct ChallengeCanonicityArgs {
        bytes inputTx;
        uint256 inputUtxoPos;
        bytes inFlightTx;
        uint16 inFlightTxInputIndex;
        bytes competingTx;
        uint16 competingTxInputIndex;
        uint256 competingTxPos;
        bytes competingTxInclusionProof;
        bytes competingTxWitness;
    }

    /**
     * @notice Wraps arguments for challenging in-flight exit input spent
     * @param inFlightTx RLP-encoded in-flight transaction
     * @param inFlightTxInputIndex Index of spent input
     * @param challengingTx RLP-encoded challenging transaction
     * @param challengingTxInputIndex Index of spent input in a challenging transaction
     * @param challengingTxWitness Witness for challenging transactions
     * @param inputTx RLP-encoded input transaction
     * @param inputUtxoPos UTXO position of input transaction's output
     */
    struct ChallengeInputSpentArgs {
        bytes inFlightTx;
        uint16 inFlightTxInputIndex;
        bytes challengingTx;
        uint16 challengingTxInputIndex;
        bytes challengingTxWitness;
        bytes inputTx;
        uint256 inputUtxoPos;
    }

     /**
     * @notice Wraps arguments for challenging in-flight transaction output exit
     * @param inFlightTx RLP-encoded in-flight transaction
     * @param inFlightTxInclusionProof Proof that an in-flight transaction is included in Plasma
     * @param outputUtxoPos UTXO position of challenged output
     * @param challengingTx RLP-encoded challenging transaction
     * @param challengingTxInputIndex Input index of challenged output in a challenging transaction
     * @param challengingTxWitness Witness for challenging transaction
     */
    struct ChallengeOutputSpent {
        bytes inFlightTx;
        bytes inFlightTxInclusionProof;
        uint256 outputUtxoPos;
        bytes challengingTx;
        uint16 challengingTxInputIndex;
        bytes challengingTxWitness;
    }
}
