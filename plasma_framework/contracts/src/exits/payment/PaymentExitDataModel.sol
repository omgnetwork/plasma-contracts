pragma solidity ^0.5.0;

library PaymentExitDataModel {
    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct StandardExit {
        bool exitable;
        uint192 utxoPos;
        bytes32 outputId;
        // Hash of output type and output guard.
        // Correctness of them would be checked when exit starts.
        // For other steps, they just check data consistency of input args.
        bytes32 outputTypeAndGuardHash;
        address payable exitTarget;
        uint256 amount;
        uint256 bondSize;
    }

    struct StandardExitMap {
        mapping (uint192 => PaymentExitDataModel.StandardExit) exits;
    }

    struct WithdrawData {
        bytes32 outputId;
        address payable exitTarget;
        address token;
        uint256 amount;
        uint256 piggybackBondSize;
    }

    struct InFlightExit {
        // Canonicity is assumed at start, then can be challenged and is set to `false`.
        // Response to non-canonical challenge can set it back to `true`.
        bool isCanonical;
        bool isFinalized;
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
        uint256 oldestCompetitorPosition;
        uint256 bondSize;
    }

    struct InFlightExitMap {
        mapping (uint192 => PaymentExitDataModel.InFlightExit) exits;
    }
}
