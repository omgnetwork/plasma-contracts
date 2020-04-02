pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../src/exits/paymentV2/PaymentV2InFlightExitModelUtils.sol";
import { PaymentV2ExitDataModel as ExitModel } from "../../../src/exits/paymentV2/PaymentV2ExitDataModel.sol";

contract PaymentV2InFlightExitModelUtilsMock {

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
        return PaymentV2InFlightExitModelUtils.isInputEmpty(ife, index);
    }

    function isOutputEmpty(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentV2InFlightExitModelUtils.isOutputEmpty(ife, index);
    }

    function isInputPiggybacked(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentV2InFlightExitModelUtils.isInputPiggybacked(ife, index);
    }

    function isOutputPiggybacked(uint16 index)
        external
        view
        returns (bool)
    {
        return PaymentV2InFlightExitModelUtils.isOutputPiggybacked(ife, index);
    }

    function setInputPiggybacked(uint16 index)
        external
    {
        PaymentV2InFlightExitModelUtils.setInputPiggybacked(ife, index);
    }

    function clearInputPiggybacked(uint16 index)
        external
    {
        PaymentV2InFlightExitModelUtils.clearInputPiggybacked(ife, index);
    }

    function setOutputPiggybacked(uint16 index)
        external
    {
        PaymentV2InFlightExitModelUtils.setOutputPiggybacked(ife, index);
    }

    function clearOutputPiggybacked(uint16 index)
        external
    {
        PaymentV2InFlightExitModelUtils.clearOutputPiggybacked(ife, index);
    }

    function isInFirstPhase(uint256 minExitPeriod)
        external
        view
        returns (bool)
    {
        return PaymentV2InFlightExitModelUtils.isInFirstPhase(ife, minExitPeriod);
    }
}
