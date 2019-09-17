pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../utils/Bits.sol";
import { PaymentExitDataModel as ExitModel } from "./PaymentExitDataModel.sol";

library PaymentInFlightExitModelUtils {
    using Bits for uint256;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    function isInputPiggybacked(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        return ife.exitMap.bitSet(uint8(index));
    }

    function isOutputPiggybacked(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        return ife.exitMap.bitSet(indexInExitMap);
    }

    function setInputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        ife.exitMap = ife.exitMap.setBit(uint8(index));
    }

    function clearInputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        ife.exitMap = ife.exitMap.clearBit(uint8(index));
    }

    function clearOutputPiggyback(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        ife.exitMap = ife.exitMap.clearBit(indexInExitMap);
    }

    function setOutputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        ife.exitMap = ife.exitMap.setBit(indexInExitMap);
    }

    function isInFirstPhase(ExitModel.InFlightExit memory ife, uint256 minExitPeriod)
        internal
        view
        returns (bool)
    {
        uint256 periodTime = minExitPeriod / 2;
        return ((block.timestamp - ife.exitStartTimestamp) / periodTime) < 1;
    }

    function isFirstPiggybackOfTheToken(ExitModel.InFlightExit memory ife, address token)
        internal
        pure
        returns (bool)
    {
        bool isPiggybackInput = true;
        for (uint i = 0; i < MAX_INPUT_NUM; i++) {
            if (isInputPiggybacked(ife, uint16(i)) && ife.inputs[i].token == token) {
                return false;
            }
        }

        isPiggybackInput = false;
        for (uint i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (isOutputPiggybacked(ife, uint16(i)) && ife.outputs[i].token == token) {
                return false;
            }
        }

        return true;
    }
}
