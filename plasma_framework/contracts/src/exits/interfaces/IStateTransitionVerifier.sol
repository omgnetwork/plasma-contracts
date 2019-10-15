pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

interface IStateTransitionVerifier {

    /**
    * @notice Verifies state transition logic.
    * @param txBytes The targeting transaction that verifies the state transition.
    * @param inputTxs Input transactions of the targeting transaction that verifies state transition.
    * @param outputIndexOfInputTxs The output index of the input txs that the transaction input points to.
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
