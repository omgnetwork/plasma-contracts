pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

contract FailedTransferAttacker {

    function () external payable {
        require(false, "failing on purpose");
    }
}
