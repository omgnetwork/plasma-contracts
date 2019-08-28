pragma solidity ^0.5.0;

library PaymentInFlightExitRouterArgs {
    /**
    * @notice Wraps arguments for startInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputTxs Transactions that created the inputs to the in-flight transaction. In the same order as in-flight transaction inputs.
    * @param inputUtxosPos Utxos that represent in-flight transaction inputs. In the same order as input transactions.
    * @param inputUtxosTypes Output types of in flight transaction inputs. In the same order as input transactions.
    * @param inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid. In the same order as input transactions.
    * @param inFlightTxWitnesses Witnesses for in-flight transaction. In the same order as input transactions.
    */
    struct StartExitArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        bytes[] inputTxsInclusionProofs;
        bytes[] inFlightTxWitnesses;
    }

    /**
    * @notice Wraps arguments for piggybackInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param isPiggybackInput A flag to decide whether it is piggybacking on input or output
    * @param index Index of the input/output to piggyback on.
    * @param outputType The output type of the piggyback output.
    * @param outputGuardPreimage The original data (pre-image) for the outputguard.
    */
    struct PiggybackInFlightExitArgs {
        bytes inFlightTx;
        bool isPiggybackInput;
        uint16 index;
        uint256 outputType;
        bytes outputGuardPreimage;
    }

    /*
     * @notice Wraps arguments for challenge in-flight exit not canonical.
     * @param inFlightTx RLP encoded in-flight transaction.
     * @param inFlightTxInputIndex Index of shared input in transaction in flight.
     * @param competingTx RLP encoded competing transaction.
     * @param competingTxInputIndex Index of shared input in competing transaction.
     * @param competingTxInputOutputType Output type of shared input.
     * @param competingTxPos (optional) Position of competing transaction in chain if included.
     * @param competingTxInclusionProof (optional) Merkle proofs that show the competing transaction was contained in chain.
     * @param competingTxWitness Witness for competing transaction.
     */
    struct ChallengeCanonicityArgs {
        bytes inFlightTx;
        uint8 inFlightTxInputIndex;
        bytes competingTx;
        uint8 competingTxInputIndex;
        uint256 competingTxInputOutputType;
        uint256 competingTxPos;
        bytes competingTxInclusionProof;
        bytes competingTxWitness;
    }
}
