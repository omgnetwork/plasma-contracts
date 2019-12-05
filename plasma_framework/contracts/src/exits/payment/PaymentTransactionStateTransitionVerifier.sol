pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../interfaces/IStateTransitionVerifier.sol";
import "../payment/PaymentExitDataModel.sol";
import "../../utils/UtxoPosLib.sol";
import "../../transactions/GenericTransaction.sol";
import "../../transactions/PaymentTransactionModel.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
* @notice Verifies state transitions for payment transaction
* @dev For payment transaction to be valid, the state transition should check that the sum of the inputs is larger than the sum of the outputs
*/
contract PaymentTransactionStateTransitionVerifier {
    using SafeMath for uint256;

    /**
     * @dev For payment transaction to be valid, the state transition should check that the sum of the inputs is larger than the sum of the outputs
     */
    function isCorrectStateTransition(
        bytes calldata txBytes,
        bytes[] calldata inputTxs,
        uint16[] calldata outputIndexOfInputTxs
    )
        external
        pure
        returns (bool)
    {
        if (inputTxs.length != outputIndexOfInputTxs.length) {
            return false;
        }

        GenericTransaction.Output[] memory inputs = new GenericTransaction.Output[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            uint16 outputIndex = outputIndexOfInputTxs[i];
            GenericTransaction.Output memory output = GenericTransaction.getOutput(
                GenericTransaction.decode(inputTxs[i]),
                outputIndex
            );
            inputs[i] = output;
        }

        PaymentTransactionModel.Transaction memory transaction = PaymentTransactionModel.decode(txBytes);
        GenericTransaction.Output[] memory outputs = new GenericTransaction.Output[](transaction.outputs.length);
        for (uint i = 0; i < transaction.outputs.length; i++) {
            outputs[i] = GenericTransaction.Output(
                    transaction.outputs[i].outputType,
                    transaction.outputs[i].outputGuard,
                    transaction.outputs[i].token,
                    transaction.outputs[i].amount
                );
        }

        return _isCorrectStateTransition(inputs, outputs);
    }

    function _isCorrectStateTransition(
        GenericTransaction.Output[] memory inputs,
        GenericTransaction.Output[] memory outputs
    )
        private
        pure
        returns (bool)
    {
        bool correctTransition = true;
        uint i = 0;
        while (correctTransition && i < outputs.length) {
            address token = outputs[i].token;
            GenericTransaction.Output[] memory inputsForToken = filterWithToken(inputs, token);
            GenericTransaction.Output[] memory outputsForToken = filterWithToken(outputs, token);

            correctTransition = isCorrectSpend(inputsForToken, outputsForToken);
            i += 1;
        }
        return correctTransition;
    }

    function filterWithToken(
        GenericTransaction.Output[] memory outputs,
        address token
    )
        private
        pure
        returns (GenericTransaction.Output[] memory)
    {
        // Required for calculating the size of the filtered array
        uint256 arraySize = 0;
        for (uint i = 0; i < outputs.length; ++i) {
            if (outputs[i].token == token) {
                arraySize += 1;
            }
        }

        GenericTransaction.Output[] memory outputsWithToken = new GenericTransaction.Output[](arraySize);
        uint j = 0;
        for (uint i = 0; i < outputs.length; ++i) {
            if (outputs[i].token == token) {
                outputsWithToken[j] = outputs[i];
                j += 1;
            }
        }

        return outputsWithToken;
    }

    function isCorrectSpend(
        GenericTransaction.Output[] memory inputs,
        GenericTransaction.Output[] memory outputs
    )
        internal
        pure
        returns (bool)
    {
        uint256 amountIn = sumAmounts(inputs);
        uint256 amountOut = sumAmounts(outputs);
        return amountIn >= amountOut;
    }

    function sumAmounts(GenericTransaction.Output[] memory outputs) private pure returns (uint256) {
        uint256 amount = 0;
        for (uint i = 0; i < outputs.length; i++) {
            amount = amount.add(outputs[i].amount);
        }
        return amount;
    }
}
