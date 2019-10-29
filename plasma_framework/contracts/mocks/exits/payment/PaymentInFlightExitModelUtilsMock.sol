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
