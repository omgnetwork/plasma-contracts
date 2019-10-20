pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

interface IStateTransitionVerifier {

    /**
    * @notice Verifies state transition logic
    * @param txBytes The transaction that does the state transition to verify
    * @param inputTxs Input transaction to the transaction to verify
    * @param outputIndexOfInputTxs Output index of the input txs that the transaction input points to
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
