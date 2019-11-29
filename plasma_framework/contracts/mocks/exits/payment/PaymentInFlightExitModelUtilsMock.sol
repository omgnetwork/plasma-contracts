pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../src/exits/payment/PaymentInFlightExitModelUtils.sol";
import { PaymentExitDataModel as ExitModel } from "../../../src/exits/payment/PaymentExitDataModel.sol";

contract PaymentInFlightExitModelUtilsMock {

    ExitModel.InFlightExit public ife;

    constructor(uint256 exitMap, uint64 exitStartTimestamp) public {
        ife.exitMap = exitMap;
        ife.exitStartTimestamp = exitStartTimestamp;
    }

    /** Helper functions */
    function setWithdrawData(
        string memory target,
        uint16 index,
        ExitModel.WithdrawData memory data
    )
        public
    {
        if (stringEquals(target, "inputs")) {
            ife.inputs[index] = data;
        } else if (stringEquals(target, "outputs")) {
            ife.outputs[index] = data;
        } else {
            revert("target should be either inputs or outputs");
        }
    }

    function stringEquals(string memory a, string memory b) private pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    /** Wrapper functions */
    function isInputEmpty(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentInFlightExitModelUtils.isInputEmpty(ife, index);
    }

    function isOutputEmpty(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentInFlightExitModelUtils.isOutputEmpty(ife, index);
    }

    function isInputPiggybacked(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentInFlightExitModelUtils.isInputPiggybacked(ife, index);
    }

    function isOutputPiggybacked(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentInFlightExitModelUtils.isOutputPiggybacked(ife, index);
    }

    function setInputPiggybacked(uint16 index)
        external
    {
        PaymentInFlightExitModelUtils.setInputPiggybacked(ife, index);
    }

    function clearInputPiggybacked(uint16 index)
        external
    {
        PaymentInFlightExitModelUtils.clearInputPiggybacked(ife, index);
    }

    function setOutputPiggybacked(uint16 index)
        external
    {
        PaymentInFlightExitModelUtils.setOutputPiggybacked(ife, index);
    }

    function clearOutputPiggybacked(uint16 index)
        external
    {
        PaymentInFlightExitModelUtils.clearOutputPiggybacked(ife, index);
    }

    function isInFirstPhase(uint256 minExitPeriod)
        external
        view
        returns (bool)
    {
        return PaymentInFlightExitModelUtils.isInFirstPhase(ife, minExitPeriod);
    }
}
