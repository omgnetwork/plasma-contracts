pragma solidity ^0.5.0;

library PaymentExitDataModel {
    struct StandardExit {
        bool exitable;
        uint192 position;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}
