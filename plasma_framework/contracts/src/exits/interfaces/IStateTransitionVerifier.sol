pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

interface IStateTransitionVerifier {

    /**
    * @notice Verifies state transition logic.
    */
    function isCorrectStateTransition(
        bytes calldata inFlightTx,
        bytes[] calldata inputTxs,
        uint256[] calldata inputUtxosPos
    )
        external
        view
        returns (bool);
}
