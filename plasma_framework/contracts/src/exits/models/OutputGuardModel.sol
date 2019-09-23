pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

library OutputGuardModel {
    /**
     * @param guard the output guard inside an output
     * @param outputType the output type that the guard holds
     * @param preimage the original data of the output guard aside from output type information
     */
    struct Data {
        bytes20 guard;
        uint256 outputType;
        bytes preimage;
    }
}
