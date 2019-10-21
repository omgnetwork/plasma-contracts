pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

library OutputGuardModel {
    /**
     * @dev The data structure used for IOutputGuardHandler, containing essential data related to output guard
     * @param guard The output guard inside an output
     * @param preimage Original data of the output guard
     */
    struct Data {
        bytes20 guard;
        bytes preimage;
    }
}
