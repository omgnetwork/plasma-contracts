pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

contract FallbackFunctionFailAttacker {
    function () external payable {
        revert("fail on fallback function");
    }
}
