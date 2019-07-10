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
     * @notice The function that checks output spending condition via authenticate owner.
     * @param _outputGuard bytes that hold the address of owner directly.
     * @param _utxoPos serves as the identifier of output.
     * @param _consumeTx The rlp encoded transaction that consumes the output.
     * @param _inputIndex The input index of the consume transaction that points to the output.
     * @param _signature The signature of the output owner.
     */
    function verify(
        bytes32 _outputGuard,
        uint256 _utxoPos,
        bytes32 /*_outputId*/,
        bytes calldata _consumeTx,
        uint8 _inputIndex,
        bytes calldata _signature
    )
        external
        view
        returns (bool)
    {
        PaymentTransactionModel.Transaction memory consumeTx = PaymentTransactionModel.decode(_consumeTx);
        require(consumeTx.txType == PAYMENT_TX_TYPE, "The consume tx is not of payment tx type");
        require(consumeTx.inputs[_inputIndex] == bytes32(_utxoPos), "The consume tx does not consume the output with such utxo pos");

        address payable owner = AddressPayable.convert(address(uint256(_outputGuard)));
        require(owner == ECDSA.recover(eip712.hashTx(consumeTx), _signature), "tx not correctly signed");

        return true;
    }
}
