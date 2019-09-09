pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IStateTransitionVerifier.sol";
import "../payment/PaymentExitDataModel.sol";
import "../../utils/UtxoPosLib.sol";
import "../../transactions/WireTransaction.sol";
import "../../transactions/PaymentTransactionModel.sol";
import "../../transactions/outputs/PaymentOutputModel.sol";

/*
* Verifies state transitions for payment transaction
*/
contract PaymentTransactionStateTransitionVerifier {

    struct StateTransitionArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputUtxosPos;
    }

    function isCorrectStateTransition(
        bytes calldata inFlightTx,
        bytes[] calldata inputTxs,
        uint256[] calldata inputUtxosPos
    )
        external
        pure
        returns (bool)
    {
        if (inputTxs.length != inputUtxosPos.length) {
            return false;
        }

        //TODO: refactor that to smaller function as soon as this issue is resolved: https://github.com/ethereum/solidity/issues/6835
        WireTransaction.Output[] memory inputs = new WireTransaction.Output[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            uint16 outputIndex = UtxoPosLib.outputIndex(UtxoPosLib.UtxoPos(inputUtxosPos[i]));
            WireTransaction.Output memory output = WireTransaction.getOutput(inputTxs[i], outputIndex);
            inputs[i] = output;
        }

        WireTransaction.Output[] memory outputs = new WireTransaction.Output[](inputTxs.length);
        PaymentTransactionModel.Transaction memory transaction = PaymentTransactionModel.decode(inFlightTx);
        for (uint i = 0; i < transaction.outputs.length; i++) {
            outputs[i] = WireTransaction.Output(transaction.outputs[i].amount, transaction.outputs[i].outputGuard, transaction.outputs[i].token);
        }

        return _isCorrectStateTransition(inputs, outputs);
    }

    function _isCorrectStateTransition(
        WireTransaction.Output[] memory inputs,
        WireTransaction.Output[] memory outputs
    )
        private
        pure
        returns (bool)
    {
        bool correctTransition = true;
        uint i = 0;
        while (correctTransition && i < outputs.length) {
            address token = outputs[i].token;
            WireTransaction.Output[] memory inputsForToken = filterWithToken(inputs, token);
            WireTransaction.Output[] memory outputsForToken = filterWithToken(outputs, token);

            correctTransition = isCorrectSpend(inputsForToken, outputsForToken);
            i += 1;
        }
        return correctTransition;
    }

    function filterWithToken(
        WireTransaction.Output[] memory outputs,
        address token
    )
        private
        pure
        returns (WireTransaction.Output[] memory)
    {
        // it is needed to calculate the size of the filtered array
        uint256 arraySize = 0;
        for (uint i = 0; i < outputs.length; ++i) {
            if (outputs[i].token == token) {
                arraySize += 1;
            }
        }

        WireTransaction.Output[] memory outputsWithToken = new WireTransaction.Output[](arraySize);
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
        WireTransaction.Output[] memory inputs,
        WireTransaction.Output[] memory outputs
    )
        internal
        pure
        returns (bool)
    {
        uint256 amountIn = sumAmounts(inputs);
        uint256 amountOut = sumAmounts(outputs);
        return amountIn >= amountOut;
    }

    function sumAmounts(WireTransaction.Output[] memory outputs) private pure returns (uint256) {
        uint256 amount = 0;
        for (uint i = 0; i < outputs.length; i++) {
            amount += outputs[i].amount;
        }
        return amount;
    }
}
