pragma solidity ^0.5.0;

library PaymentExitDataModel {
    struct StandardExit {
        bool exitable;
        // hash of verified output related data during start exit step
        // so it does not need to re-verify those data when challanging.
        // It would be proving data consistency between steps instead.
        bytes32 outputRelatedDataHash;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}
