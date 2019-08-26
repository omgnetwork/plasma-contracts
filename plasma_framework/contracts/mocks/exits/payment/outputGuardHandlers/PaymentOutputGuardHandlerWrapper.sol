pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/models/OutputGuardModel.sol";
import "../../../../src/exits/payment/outputGuardHandlers/PaymentOutputGuardHandler.sol";

/**
For unkown reason truffle is not able to pass in the struct of OutputGuardModel.Data as input args directly.
As a result using this wrapper to wrap the input args to the struct and test.
 */
contract PaymentOutputGuardHandlerWrapper {
    PaymentOutputGuardHandler handler;

    constructor(uint256 outputType) public {
        handler = new PaymentOutputGuardHandler(outputType);
    }

    function isValid(bytes32 outputGuard, uint256 outputType, bytes memory outptuGuardPreimage)
        public
        view
        returns(bool)
    {
        OutputGuardModel.Data memory data = OutputGuardModel.Data({
            guard: outputGuard,
            outputType: outputType,
            preimage: outptuGuardPreimage
        });
        return handler.isValid(data);
    }

    function getExitTarget(bytes32 outputGuard, uint256 outputType, bytes memory outptuGuardPreimage)
        public
        view
        returns (address payable)
    {
        OutputGuardModel.Data memory data = OutputGuardModel.Data({
            guard: outputGuard,
            outputType: outputType,
            preimage: outptuGuardPreimage
        });
        return handler.getExitTarget(data);
    }
}
