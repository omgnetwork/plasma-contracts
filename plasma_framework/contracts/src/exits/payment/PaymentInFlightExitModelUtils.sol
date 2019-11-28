pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../utils/Bits.sol";
import { PaymentExitDataModel as ExitModel } from "./PaymentExitDataModel.sol";

library PaymentInFlightExitModelUtils {
    using Bits for uint256;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    function isInputEmpty(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        require(index < MAX_INPUT_NUM, "Invalid input index");
        return isEmptyWithdrawData(ife.inputs[index]);
    }

    function isOutputEmpty(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        require(index < MAX_OUTPUT_NUM, "Invalid output index");
        return isEmptyWithdrawData(ife.outputs[index]);
    }

    function isInputPiggybacked(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        require(index < MAX_INPUT_NUM, "Invalid input index");
        return ife.exitMap.bitSet(uint8(index));
    }

    function isOutputPiggybacked(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        require(index < MAX_OUTPUT_NUM, "Invalid output index");
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        return ife.exitMap.bitSet(indexInExitMap);
    }

    function setInputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        require(index < MAX_INPUT_NUM, "Invalid input index");
        ife.exitMap = ife.exitMap.setBit(uint8(index));
    }

    function clearInputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        require(index < MAX_INPUT_NUM, "Invalid input index");
        ife.exitMap = ife.exitMap.clearBit(uint8(index));
    }

    function setOutputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        require(index < MAX_OUTPUT_NUM, "Invalid output index");
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        ife.exitMap = ife.exitMap.setBit(indexInExitMap);
    }

    function clearOutputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        require(index < MAX_OUTPUT_NUM, "Invalid output index");
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        ife.exitMap = ife.exitMap.clearBit(indexInExitMap);
    }

    function isInFirstPhase(ExitModel.InFlightExit memory ife, uint256 minExitPeriod)
        internal
        view
        returns (bool)
    {
        uint256 periodTime = minExitPeriod / 2;
        return ((block.timestamp - ife.exitStartTimestamp) / periodTime) < 1;
    }

    function isEmptyWithdrawData(ExitModel.WithdrawData memory data) private pure returns (bool) {
        return data.outputId == bytes32("") &&
                data.exitTarget == address(0) &&
                data.token == address(0) &&
                data.amount == 0 &&
                data.piggybackBondSize == 0;
    }
}
