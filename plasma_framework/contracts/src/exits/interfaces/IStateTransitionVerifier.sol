pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

interface IStateTransitionVerifier {

    /**
    * @notice Verifies state transition logic.
    * @param txBytes the targeting transaction that is doing the state transition verification
    * @param inputTxs input transactions of the targeting transaction checking state transition
    * @param outputIndexOfInputTxs the output index of the input txs that the transaction input is pointing to
    */
    function isCorrectStateTransition(
        bytes calldata txBytes,
        bytes[] calldata inputTxs,
        uint16[] calldata outputIndexOfInputTxs
    )
        external
        view
        returns (bool);
}
