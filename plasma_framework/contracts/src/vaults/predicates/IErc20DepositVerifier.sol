pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {PaymentTransactionModel as DepositTx} from "../../transactions/PaymentTransactionModel.sol";

contract IErc20DepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _owner The owner of the deposit transaction.
     */
    function verify(DepositTx.Transaction memory _depositTx, address _owner) public pure;
}
