pragma solidity ^0.5.0;

library PaymentExitDataModel {
    struct StandardExit {
        bool exitable;
        uint192 utxoPos;
        bytes32 outputId;
        // Hash of output type and output guard.
        // Correctness of them would be checked when exit starts.
        // For other steps, they just check data consistenct from input args.
        bytes32 outputTypeAndGuardHash;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}
