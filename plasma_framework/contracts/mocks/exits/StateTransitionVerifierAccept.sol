pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../src/exits/IStateTransitionVerifier.sol";

contract StateTransitionVerifierAccept is IStateTransitionVerifier {

    function isCorrectStateTransition(
        bytes calldata /*inFlightTx*/,
        bytes[] calldata /*inputTxs*/,
        uint256[] calldata /*inputUtxosPos*/
    )
        external
        view
        returns (bool)
    {
        return true;
    }
}
