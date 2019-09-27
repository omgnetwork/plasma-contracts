pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

library OutputGuardModel {
    /**
     * @dev The data structure that is being used for IOutputGuardHandler. Contains essential data related to output guard.
     * @param guard the output guard inside an output
     * @param preimage the original data of the output guard
     */
    struct Data {
        bytes20 guard;
        bytes preimage;
    }
}
