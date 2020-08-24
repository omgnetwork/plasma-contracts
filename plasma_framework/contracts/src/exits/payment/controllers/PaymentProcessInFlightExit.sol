pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";

library PaymentProcessInFlightExit {
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        EthVault ethVault;
        Erc20Vault erc20Vault;
        uint256 safeGasStipend;
    }

    event InFlightExitOmitted(
        uint168 indexed exitId,
        address token
    );

    event InFlightExitOutputWithdrawn(
        uint168 indexed exitId,
        uint16 outputIndex
    );

    event InFlightExitInputWithdrawn(
        uint168 indexed exitId,
        uint16 inputIndex
    );

    event InFlightBondReturnFailed(
        address indexed receiver,
        uint256 amount
    );

    /**
     * @notice Main logic function to process in-flight exit
     * @dev emits InFlightExitOmitted event if the exit is omitted
     * @dev emits InFlightBondReturnFailed event if failed to pay out bond. Would continue to process the exit.
     * @dev emits InFlightExitInputWithdrawn event if the input of IFE is withdrawn successfully
     * @dev emits InFlightExitOutputWithdrawn event if the output of IFE is withdrawn successfully
     * @param self The controller struct
     * @param exitMap The storage of all in-flight exit data
     * @param exitId The exitId of the in-flight exit
     * @param token The ERC20 token address of the exit; uses address(0) to represent ETH
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage exitMap,
        uint168 exitId,
        address token
    )
        public
    {
        PaymentExitDataModel.InFlightExit storage exit = exitMap.exits[exitId];

        if (exit.exitStartTimestamp == 0) {
            emit InFlightExitOmitted(exitId, token);
            return;
        }

        /* To prevent a double spend, it is needed to know if an output can be exited.
         * An output can not be exited if:
         * - it is finalized by a standard exit
         * - it is finalized by an in-flight exit as input of a non-canonical transaction
         * - it is blocked from exiting, because it is an input of a canonical transaction
         *   that exited from one of it's outputs
         * - it is finalized by an in-flight exit as an output of a canonical transaction
         * - it is an output of a transaction for which at least one of its inputs is already finalized
         *
         * Hence, Plasma Framework stores each output with an exit id that finalized it.
         * When transaction is marked as canonical but any of it's input was finalized by
         * other exit, it is not allowed to exit from the transaction's outputs.
         * In that case exit from an unspent input is possible.
         * When all inputs of a transaction that is marked as canonical are either not finalized or finalized
         * by the same exit (which means they were marked as finalized when processing the same exit for a different token),
         * only exit from outputs is possible.
         *
         * See: https://github.com/omisego/plasma-contracts/issues/102#issuecomment-495809967 for more details
         */
        if (!exit.isCanonical || isAnyInputFinalizedByOtherExit(self.framework, exit, exitId)) {
            for (uint16 i = 0; i < exit.inputs.length; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.inputs[i];

                if (shouldWithdrawInput(self, exit, withdrawal, token, i)) {
                    withdrawFromVault(self, withdrawal);
                    emit InFlightExitInputWithdrawn(exitId, i);
                }
            }

            flagOutputsWhenNonCanonical(self.framework, exit, token, exitId);
        } else {
            for (uint16 i = 0; i < exit.outputs.length; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.outputs[i];

                if (shouldWithdrawOutput(self, exit, withdrawal, token, i)) {
                    withdrawFromVault(self, withdrawal);
                    emit InFlightExitOutputWithdrawn(exitId, i);
                }
            }

            flagOutputsWhenCanonical(self.framework, exit, token, exitId);
        }

        returnInputPiggybackBonds(self, exit, token);
        returnOutputPiggybackBonds(self, exit, token);

        clearPiggybackInputFlag(exit, token);
        clearPiggybackOutputFlag(exit, token);

        if (allPiggybacksCleared(exit)) {
            bool success = SafeEthTransfer.transferReturnResult(
                exit.bondOwner, exit.bondSize, self.safeGasStipend
            );

            // we do not want to block a queue if bond return is unsuccessful
            if (!success) {
                emit InFlightBondReturnFailed(exit.bondOwner, exit.bondSize);
            }
            delete exitMap.exits[exitId];
        }
    }

    function isAnyInputFinalizedByOtherExit(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        uint168 exitId
    )
        private
        view
        returns (bool)
    {
        uint256 nonEmptyInputIndex;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (!exit.isInputEmpty(i)) {
                nonEmptyInputIndex++;
            }
        }
        bytes32[] memory outputIdsOfInputs = new bytes32[](nonEmptyInputIndex);
        nonEmptyInputIndex = 0;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (!exit.isInputEmpty(i)) {
                outputIdsOfInputs[nonEmptyInputIndex] = exit.inputs[i].outputId;
                nonEmptyInputIndex++;
            }
        }
        return framework.isAnyInputFinalizedByOtherExit(outputIdsOfInputs, exitId);
    }

    function shouldWithdrawInput(
        Controller memory controller,
        PaymentExitDataModel.InFlightExit memory exit,
        PaymentExitDataModel.WithdrawData memory withdrawal,
        address token,
        uint16 index
    )
        private
        view
        returns (bool)
    {
        return withdrawal.token == token &&
                exit.isInputPiggybacked(index) &&
                !controller.framework.isOutputFinalized(withdrawal.outputId);
    }

    function shouldWithdrawOutput(
        Controller memory controller,
        PaymentExitDataModel.InFlightExit memory exit,
        PaymentExitDataModel.WithdrawData memory withdrawal,
        address token,
        uint16 index
    )
        private
        view
        returns (bool)
    {
        return withdrawal.token == token &&
                exit.isOutputPiggybacked(index) &&
                !controller.framework.isOutputFinalized(withdrawal.outputId);
    }

    function withdrawFromVault(
        Controller memory self,
        PaymentExitDataModel.WithdrawData memory withdrawal
    )
        private
    {
        if (withdrawal.token == address(0)) {
            self.ethVault.withdraw(withdrawal.exitTarget, withdrawal.amount);
        } else {
            self.erc20Vault.withdraw(withdrawal.exitTarget, withdrawal.token, withdrawal.amount);
        }
    }

    function flagOutputsWhenNonCanonical(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        address token,
        uint168 exitId
    )
        private
    {
        uint256 piggybackedInputNumOfTheToken;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (exit.inputs[i].token == token && exit.isInputPiggybacked(i)) {
                piggybackedInputNumOfTheToken++;
            }
        }

        bytes32[] memory outputIdsToFlag = new bytes32[](piggybackedInputNumOfTheToken);
        uint indexForOutputIds = 0;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (exit.inputs[i].token == token && exit.isInputPiggybacked(i)) {
                outputIdsToFlag[indexForOutputIds] = exit.inputs[i].outputId;
                indexForOutputIds++;
            }
        }
        framework.batchFlagOutputsFinalized(outputIdsToFlag, exitId);
    }

    function flagOutputsWhenCanonical(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        address token,
        uint168 exitId
    )
        private
    {
        uint256 inputNumOfTheToken;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (!exit.isInputEmpty(i)) {
                inputNumOfTheToken++;
            }
        }

        uint256 piggybackedOutputNumOfTheToken;
        for (uint16 i = 0; i < exit.outputs.length; i++) {
            if (exit.outputs[i].token == token && exit.isOutputPiggybacked(i)) {
                piggybackedOutputNumOfTheToken++;
            }
        }

        bytes32[] memory outputIdsToFlag = new bytes32[](inputNumOfTheToken + piggybackedOutputNumOfTheToken);
        uint indexForOutputIds = 0;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (!exit.isInputEmpty(i)) {
                outputIdsToFlag[indexForOutputIds] = exit.inputs[i].outputId;
                indexForOutputIds++;
            }
        }
        for (uint16 i = 0; i < exit.outputs.length; i++) {
            if (exit.outputs[i].token == token && exit.isOutputPiggybacked(i)) {
                outputIdsToFlag[indexForOutputIds] = exit.outputs[i].outputId;
                indexForOutputIds++;
            }
        }
        framework.batchFlagOutputsFinalized(outputIdsToFlag, exitId);
    }

    function returnInputPiggybackBonds(
        Controller memory self,
        PaymentExitDataModel.InFlightExit storage exit,
        address token
    )
        private
    {
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            PaymentExitDataModel.WithdrawData memory withdrawal = exit.inputs[i];

            // If the input has been challenged, isInputPiggybacked() will return false
            if (token == withdrawal.token && exit.isInputPiggybacked(i)) {
                bool success = SafeEthTransfer.transferReturnResult(
                    withdrawal.exitTarget, withdrawal.piggybackBondSize, self.safeGasStipend
                );

                // we do not want to block a queue if bond return is unsuccessful
                if (!success) {
                    emit InFlightBondReturnFailed(withdrawal.exitTarget, withdrawal.piggybackBondSize);
                }
            }
        }
    }

    function returnOutputPiggybackBonds(
        Controller memory self,
        PaymentExitDataModel.InFlightExit storage exit,
        address token
    )
        private
    {
        for (uint16 i = 0; i < exit.outputs.length; i++) {
            PaymentExitDataModel.WithdrawData memory withdrawal = exit.outputs[i];

            // If the output has been challenged, isOutputPiggybacked() will return false
            if (token == withdrawal.token && exit.isOutputPiggybacked(i)) {
                bool success = SafeEthTransfer.transferReturnResult(
                    withdrawal.exitTarget, withdrawal.piggybackBondSize, self.safeGasStipend
                );

                // we do not want to block a queue if bond return is unsuccessful
                if (!success) {
                    emit InFlightBondReturnFailed(withdrawal.exitTarget, withdrawal.piggybackBondSize);
                }
            }
        }
    }

    function clearPiggybackInputFlag(
        PaymentExitDataModel.InFlightExit storage exit,
        address token
    )
        private
    {
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (token == exit.inputs[i].token) {
                exit.clearInputPiggybacked(i);
            }
        }
    }

    function clearPiggybackOutputFlag(
        PaymentExitDataModel.InFlightExit storage exit,
        address token
    )
        private
    {
        for (uint16 i = 0; i < exit.outputs.length; i++) {
            if (token == exit.outputs[i].token) {
                exit.clearOutputPiggybacked(i);
            }
        }
    }

    function allPiggybacksCleared(PaymentExitDataModel.InFlightExit memory exit) private pure returns (bool) {
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (exit.isInputPiggybacked(i))
                return false;
        }

        for (uint16 i = 0; i < exit.outputs.length; i++) {
            if (exit.isOutputPiggybacked(i))
                return false;
        }

        return true;
    }
}
