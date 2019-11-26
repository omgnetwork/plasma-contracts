pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../../../utils/SafeEthTransfer.sol";

library PaymentDeleteInFlightExit {
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct Controller {
        uint256 minExitPeriod;
        uint256 safeGasStipend;
    }

    event InFlightExitDeleted(
        uint160 indexed exitId
    );

    /**
     * @notice Main logic function to delete the non piggybacked in-flight exit
     * @param exitId The exitId of the standard exit
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage exitMap,
        uint160 exitId
    )
        public
    {
        PaymentExitDataModel.InFlightExit memory ife = exitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-flight exit does not exist");
        require(!ife.isInFirstPhase(self.minExitPeriod), "Cannot delete in-flight exit still in first phase");
        require(!isPiggybacked(ife), "The in-flight exit is already piggybacked");

        delete exitMap.exits[exitId];
        SafeEthTransfer.transferRevertOnError(ife.bondOwner, ife.bondSize, self.safeGasStipend);
        emit InFlightExitDeleted(exitId);
    }

    function isPiggybacked(ExitModel.InFlightExit memory ife)
        private
        pure
        returns (bool)
    {
        for (uint16 i = 0; i < MAX_INPUT_NUM; i++) {
            if (ife.isInputPiggybacked(i)) {
                return true;
            }
        }

        for (uint16 i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (ife.isOutputPiggybacked(i)) {
                return true;
            }
        }

        return false;
    }
}
