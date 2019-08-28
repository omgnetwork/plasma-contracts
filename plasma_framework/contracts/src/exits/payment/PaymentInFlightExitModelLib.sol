pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../utils/Bits.sol";
import { PaymentExitDataModel as ExitModel } from "./PaymentExitDataModel.sol";

library PaymentInFlightExitModelLib {
    using Bits for uint256;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    function isPiggybacked(ExitModel.InFlightExit memory ife, uint16 index, bool isPiggybackInput)
        internal
        pure
        returns (bool)
    {
        uint8 indexInExitMap = isPiggybackInput? uint8(index) : uint8(index + MAX_INPUT_NUM);
        return ife.exitMap.bitSet(indexInExitMap);
    }

    function setPiggybacked(ExitModel.InFlightExit storage ife, uint16 index, bool isPiggybackInput)
        internal
    {
        uint8 indexInExitMap = isPiggybackInput? uint8(index) : uint8(index + MAX_INPUT_NUM);
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

    function isFinalized(ExitModel.InFlightExit memory ife)
        internal
        pure
        returns (bool)
    {
        return Bits.bitSet(ife.exitMap, 255);
    }

    function isFirstPiggybackOfTheToken(ExitModel.InFlightExit memory ife, address token)
        internal
        pure
        returns (bool)
    {
        bool isPiggybackInput = true;
        for (uint i = 0 ; i < MAX_INPUT_NUM ; i++) {
            if (isPiggybacked(ife, uint16(i), isPiggybackInput) && ife.inputs[i].token == token) {
                return false;
            }
        }

        isPiggybackInput = false;
        for (uint i = 0 ; i < MAX_OUTPUT_NUM ; i++) {
            if (isPiggybacked(ife, uint16(i), isPiggybackInput) && ife.outputs[i].token == token) {
                return false;
            }
        }

        return true;
    }
}
