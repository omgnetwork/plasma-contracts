pragma solidity 0.5.11;

/**
 * @notice Model library for PaymentExit
 */
library PaymentExitDataModel {
    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    /**
     * @dev Exit model for a standard exit
     * @param exitable a boolean that represents whether the exit is able to exit or not. The challenge game uses this to flag the result.
     * @param utxoPos the utxo position of the exiting output of the transaction
     * @param outputId the output identifier in OutputId format
     * @param exitTarget the address that the exit will withdraw funds to
     * @param amount the amount of funds to be withdrawn with this exit
     * @param bondSize the size of the bond put up for this exit to start. The bond is used to cover the cost of challenges.
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
     * @param isCanonical a boolean that represents whether the exit is canonical or not.
     *                    A canonical exit withdraws the outputs while a non-canonical exit withdraws the  inputs.
     * @param exitStartTimestamp the timestamp when the exit starts.
     * @param exitMap a bitmap that stores piggyback flags.
     * @param position the position of the youngest input of the in-flight exit transaction.
     * @param inputs fix sized array of data necessary for withdrawing inputs. would be with empty default value if not set.
     * @param outputs fix sized array of data necessary for withdrawing outputs. would be with empty default value if not set.
     * @param bondOwner receiver of the bond when the in-flight exit is processed.
     * @param bondSize the size of the bond put up for this exit to start. The bond is used to cover the cost of challenges.
     * @param oldestCompetitorPosition the position of oldest competing transaction.
     *                                 The exiting transaction is only canonical if all competing transactions are younger than it.
     */
    struct InFlightExit {
        // Canonicity is assumed at start, then can be challenged and is set to `false`.
        // Response to non-canonical challenge can set it back to `true`.
        bool isCanonical;
        uint64 exitStartTimestamp;

        /**
         * exit map stores piggybacks and finalized exits
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
