pragma solidity ^0.5.0;

library PaymentInFlightExitRouterArgs {
    /**
    * @notice Wraps arguments for startInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputTxs Transactions that created the inputs to the in-flight transaction. In the same order as in-flight transaction inputs.
    * @param inputTxTypes Transaction type of the input transactions.
    * @param inputUtxosPos Utxos that represent in-flight transaction inputs. In the same order as input transactions.
    * @param inputUtxosTypes Output types of in flight transaction inputs. In the same order as input transactions.
    * @param outputGuardPreimagesForInputs Output guard pre-images for in-flight transaction inputs.
    * @param inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid. In the same order as input transactions.
    * @param inputTxsConfirmSigs Confirm signatures for the input txs. Should be empty bytes if the input tx is MoreVP.
    * @param inFlightTxWitnesses Witnesses for in-flight transaction. In the same order as input transactions.
    * @param inputSpendingConditionOptionalArgs Optional args for the spending condition for checking inputs. Should provide empty bytes if nothing is required.
    */
    struct StartExitArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputTxTypes;
        uint256[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        bytes[] outputGuardPreimagesForInputs;
        bytes[] inputTxsInclusionProofs;
        bytes[] inputTxsConfirmSigs;
        bytes[] inFlightTxWitnesses;
        bytes[] inputSpendingConditionOptionalArgs;
    }

    /**
    * @notice Wraps arguments for piggybackInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputIndex Index of the input/output to piggyback on.
    */
    struct PiggybackInFlightExitOnInputArgs {
        bytes inFlightTx;
        uint16 inputIndex;
    }

    /**
    * @notice Wraps arguments for piggybackInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param outputIndex Index of the output to piggyback on.
    * @param outputType The output type of the piggyback output.
    * @param outputGuardPreimage The original data (pre-image) for the outputguard.
    */
    struct PiggybackInFlightExitOnOutputArgs {
        bytes inFlightTx;
        uint16 outputIndex;
        uint256 outputType;
        bytes outputGuardPreimage;
    }

    /*
     * @notice Wraps arguments for challenge in-flight exit not canonical.
     * @param inFlightTx RLP encoded in-flight transaction.
     * @param inFlightTxInputIndex Index of shared input in transaction in flight.
     * @param competingTx RLP encoded competing transaction.
     * @param competingTxInputIndex Index of shared input in competing transaction.
     * @param outputType Output type of shared input.
     * @param outputGuardPreimage Output guard preimage of the shared input.
     * @param competingTxPos (optional) Position of competing transaction in chain if included.
     * @param competingTxInclusionProof (optional) Merkle proofs that show the competing transaction was contained in chain.
     * @param competingTxWitness Witness for competing transaction.
     * @param competingTxConfirmSig (optional) Confirm signature if the competing tx is of MVP protocol.
     * @param competingTxSpendingConditionOptionalArgs (optional) Optional arguments for the spending condition
     */
    struct ChallengeCanonicityArgs {
        bytes inputTx;
        uint256 inputUtxoPos;
        bytes inFlightTx;
        uint16 inFlightTxInputIndex;
        bytes competingTx;
        uint16 competingTxInputIndex;
        uint256 outputType;
        bytes outputGuardPreimage;
        uint256 competingTxPos;
        bytes competingTxInclusionProof;
        bytes competingTxWitness;
        bytes competingTxConfirmSig;
        bytes competingTxSpendingConditionOptionalArgs;
    }

    /*
     * @notice Wraps arguments for challenge in-flight exit input spent.
     * @param inFlightTx RLP encoded in-flight transaction.
     * @param inFlightTxInputIndex Index of input that's been spent.
     * @param challengingTx RLP encoded challenging transaction.
     * @param challengingTxInputIndex Index of spent input in challenging transaction.
     * @param challengingTxInputOutputType Output type of spent input.
     * @param challengingTxInputOutputGuardPreimage OutputGuard preimage of spent input.
     * @param challengingTxWitness Witness for challenging transaction.
     * @param inputTx RLP encoded input transaction.
     * @param inputUtxoPos Utxo position of input transaction's output.
     * @param spendingConditionOptionalArgs Optional arguments for spending condition of the input transaction.
     */
    struct ChallengeInputSpentArgs {
        bytes inFlightTx;
        uint16 inFlightTxInputIndex;
        bytes challengingTx;
        uint16 challengingTxInputIndex;
        uint256 challengingTxInputOutputType;
        bytes challengingTxInputOutputGuardPreimage;
        bytes challengingTxWitness;
        bytes inputTx;
        uint256 inputUtxoPos;
        bytes spendingConditionOptionalArgs;
    }

     /*
     * @notice Wraps arguments for challenging in-flight transaction output exit.
     * @param inFlightTx RLP encoded in-flight transaction.
     * @param inFlightTxInclusionProof Proof that in-flight transaction is included in Plasma.
     * @param outputType output type of exiting output.
     * @param outputGuardPreimage preimage for the output guard of the exiting output.
     * @param outputUtxoPos Utxo position of challenged output.
     * @param challengingTx RLP encoded challenging transaction.
     * @param challengingTxInputIndex input index of challenged output in challenging transaction.
     * @param challengingTxWitness Witness for challenging transaction.
     * @param spendingConditionOptionalArgs optional extra data for the spending condition.
     */
    struct ChallengeOutputSpent {
        bytes inFlightTx;
        bytes inFlightTxInclusionProof;
        uint256 outputType;
        bytes outputGuardPreimage;
        uint256 outputUtxoPos;
        bytes challengingTx;
        uint16 challengingTxInputIndex;
        bytes challengingTxWitness;
        bytes spendingConditionOptionalArgs;
    }
}
