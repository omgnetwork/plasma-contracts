pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/exits/interfaces/IStateTransitionVerifier.sol";

contract StateTransitionVerifierAccept is IStateTransitionVerifier {

    function isCorrectStateTransition(
        bytes calldata, /*inFlightTx*/
        bytes[] calldata, /*inputTxs*/
        uint16[] calldata /*outputIndexOfInputTxs*/
    )
        external
        view
        returns (bool)
    {
        return true;
    }
}
