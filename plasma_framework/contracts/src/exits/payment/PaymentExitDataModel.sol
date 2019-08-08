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

    struct InFlightExit {
        uint256 exitStartTimestamp;
        // exit map stores piggybacks and finalized exits
        // bit 255 is set only when ife has finalized
        // input is piggybacked only when input number bit is set
        // output is piggybacked only when MAX_INPUTS + output number bit is set
        // input is exited only when 2 * MAX_INPUTS + input number bit is set
        // output is exited only when 3 * MAX_INPUTS + output number bit is set
        uint256 exitMap;
        uint256 position;
        PaymentOutputModel.Output[MAX_INPUT_NUM] inputs;
        PaymentOutputModel.Output[MAX_OUTPUT_NUM] outputs;
        address payable bondOwner;
        uint256 oldestCompetitorPosition;
    }
}
