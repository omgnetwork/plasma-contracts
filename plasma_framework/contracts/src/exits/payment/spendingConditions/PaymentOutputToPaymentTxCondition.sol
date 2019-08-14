pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/cryptography/ECDSA.sol';

import "./IPaymentSpendingCondition.sol";
import "../../../utils/AddressPayable.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/eip712Libs/PaymentEip712Lib.sol";

contract PaymentOutputToPaymentTxCondition is IPaymentSpendingCondition {
    using PaymentEip712Lib for PaymentEip712Lib.Constants;

    uint256 constant public PAYMENT_TX_TYPE = 1;
    PaymentEip712Lib.Constants eip712;

    constructor(address _framework) public {
        eip712 = PaymentEip712Lib.initConstants(_framework);
    }

    /**
     * @notice Checks if given output has been spent by owner in given spending transaction.
     * @dev _utxoPos not used, serves as the position identifier of output.
     * @param _outputGuard bytes that hold the address of owner directly.
     * @param _outputIdentifier serves as the identifier of output (spendingTx is supposed to contain it as input).
     * @param _spendingTx The rlp encoded transaction that spends the output.
     * @param _inputIndex The input index of the spending transaction that points to the output.
     * @param _signature The signature of the output owner.
     */
    function verify(
        bytes32 _outputGuard,
        uint256, /*_utxoPos  NOTE: It's unclear how & if this will be used at all, see: https://github.com/omisego/plasma-contracts/pull/212*/
        bytes32 _outputIdentifier,
        bytes calldata _spendingTx,
        uint8 _inputIndex,
        bytes calldata _signature
    )
        external
        view
        returns (bool)
    {
        PaymentTransactionModel.Transaction memory spendingTx = PaymentTransactionModel.decode(_spendingTx);
        require(spendingTx.txType == PAYMENT_TX_TYPE, "The spending tx is not of payment tx type");
        require(
            spendingTx.inputs[_inputIndex] == _outputIdentifier,
            "The spending tx does not spend the output specified by output identifier"
        );

        address   owner = AddressPayable.convert(address(uint256(_outputGuard)));
        require(owner == ECDSA.recover(eip712.hashTx(spendingTx), _signature), "Tx not correctly signed");

        return true;
    }
}
