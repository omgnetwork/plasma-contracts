pragma solidity ^0.5.0;

import '../../transactions/outputs/PaymentOutputModel.sol';
import '../../transactions/PaymentTransactionModel.sol';

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
        address token;
        address payable exitTarget;
        uint256 amount;
    }

    struct StandardExitMap {
        mapping (uint192 => PaymentExitDataModel.StandardExit) exits;
    }

    struct InFlightExit {
        uint256 exitStartTimestamp;

        /**
         * exit map stores piggybacks and finalized exits
         * bit 255 is set only when in-flight exit has finalized
         * right most 0 ~ MAX_INPUT bits is flagged when input is piggybacked
         * right most MAX_INPUT ~ MAX_INPUT + MAX_OUTPUT bits is flagged when output is piggybacked
         */
        uint256 exitMap;
        uint256 position;
        PaymentOutputModel.Output[MAX_INPUT_NUM] inputs;
        PaymentOutputModel.Output[MAX_OUTPUT_NUM] outputs;
        address payable bondOwner;
        uint256 oldestCompetitorPosition;
    }

    struct InFlightExitMap {
        mapping (uint192 => PaymentExitDataModel.InFlightExit) exits;
    }
}
