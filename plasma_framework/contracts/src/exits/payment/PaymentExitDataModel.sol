pragma solidity ^0.5.0;

library PaymentExitDataModel {
    struct StandardExit {
        bool exitable;
        bytes32 outputRelatedDataHash;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}
