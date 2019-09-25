pragma solidity ^0.5.0;

/**
 * @notice Model library for PaymentExit
 */
library PaymentExitDataModel {
    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    /**
     * @dev Exit model for a standard exit
     * @param exitable a boolean to represent whether such exit is able to exit or not. The challenge game uses this to flag the result.
     * @param utxoPos the utxo position of the exiting output of the transaction
     * @param outputId the output identifier in OutputId format
     * @param exitTarget the address that the exit would withdraw fund to
     * @param amount the amount of fund to be withdrawn from this exit
     * @param bondSize the bond size put for this exit to start. Bond is used to cover the cost of challenges.
     */
    struct StandardExit {
        bool exitable;
        uint192 utxoPos;
        bytes32 outputId;
        address payable exitTarget;
        uint256 amount;
        uint256 bondSize;
    }

    /**
     * @dev mapping of (exitId => StandardExit) that stores all standard exit data
     */
    struct StandardExitMap {
        mapping (uint192 => PaymentExitDataModel.StandardExit) exits;
    }

    /**
     * @dev The necessary data needed for processExit for in-flight exit inputs/outputs
     */
    struct WithdrawData {
        bytes32 outputId;
        address payable exitTarget;
        address token;
        uint256 amount;
        uint256 piggybackBondSize;
    }

    /**
     * @dev Exit model for an in-flight exit
     * @param isCanonical a boolean to represent whether such exit is canonical or not.
     *                    Canonical exit would withdraw from output while non-canonical would withdraw from input.
     * @param exitStartTimestamp the timestamp when the exit starts.
     * @param exitMap a bitmap that stores piggyback flags.
     * @param position the youngest position of the inputs of the in-flight exit transaction.
     * @param inputs some necessary data for inputs for withdrawal on input.
     * @param outputs some necessary data for outputs for withdrawal on output.
     * @param bondOwner who would receive the bond when in-flight exit is processed.
     * @param bondSize the bond size put for this exit to start. Bond is used to cover the cost of challenges.
     * @param oldestCompetitorPosition the recorded oldest position of competing transactions.
     *                                 The transaction is only canonical if all competing tx is younger than the exiting one.
     */
    struct InFlightExit {
        // Canonicity is assumed at start, then can be challenged and is set to `false`.
        // Response to non-canonical challenge can set it back to `true`.
        bool isCanonical;
        uint64 exitStartTimestamp;

        /**
         * exit map stores piggybacks and finalized exits
         * bit 255 is set only when in-flight exit has finalized
         * right most 0 ~ MAX_INPUT bits is flagged when input is piggybacked
         * right most MAX_INPUT ~ MAX_INPUT + MAX_OUTPUT bits is flagged when output is piggybacked
         */
        uint256 exitMap;
        uint256 position;
        WithdrawData[MAX_INPUT_NUM] inputs;
        WithdrawData[MAX_OUTPUT_NUM] outputs;
        address payable bondOwner;
        uint256 bondSize;
        uint256 oldestCompetitorPosition;
    }

    /**
     * @dev mapping of (exitId => InFlightExit) that stores all in-flight exit data
     */
    struct InFlightExitMap {
        mapping (uint160 => PaymentExitDataModel.InFlightExit) exits;
    }
}
