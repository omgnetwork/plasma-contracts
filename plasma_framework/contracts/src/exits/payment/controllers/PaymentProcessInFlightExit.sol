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
        uint160 indexed exitId,
        address token
    );

    event InFlightExitOutputWithdrawn(
        uint160 indexed exitId,
        uint16 outputIndex
    );

    event InFlightExitInputWithdrawn(
        uint160 indexed exitId,
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
        uint160 exitId,
        address token
    )
        public
    {
        PaymentExitDataModel.InFlightExit storage exit = exitMap.exits[exitId];

        if (exit.exitStartTimestamp == 0) {
            emit InFlightExitOmitted(exitId, token);
            return;
        }

        // Check whether any input is already spent. Required to prevent operator stealing funds.
        // See: https://github.com/omisego/plasma-contracts/issues/102#issuecomment-495809967
        // Also, slightly different from the solution above, we treat input spent as non-canonical.
        // So an IFE is only canonical if all inputs of the in-flight tx are not double spent by competing tx or exit.
        // see: https://github.com/omisego/plasma-contracts/issues/470
        if (!exit.isCanonical || isAnyInputSpent(self.framework, exit, token)) {
            for (uint16 i = 0; i < exit.inputs.length; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.inputs[i];

                if (shouldWithdrawInput(self, exit, withdrawal, token, i)) {
                    withdrawFromVault(self, withdrawal);
                    emit InFlightExitInputWithdrawn(exitId, i);
                }
            }

            flagOutputsWhenNonCanonical(self.framework, exit, token);
        } else {
            for (uint16 i = 0; i < exit.outputs.length; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.outputs[i];

                if (shouldWithdrawOutput(self, exit, withdrawal, token, i)) {
                    withdrawFromVault(self, withdrawal);
                    emit InFlightExitOutputWithdrawn(exitId, i);
                }
            }

            flagOutputsWhenCanonical(self.framework, exit, token);
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

    function isAnyInputSpent(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        address token
    )
        private
        view
        returns (bool)
    {
        uint256 inputNumOfTheToken;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (exit.inputs[i].token == token && !exit.isInputEmpty(i)) {
                inputNumOfTheToken++;
            }
        }
        bytes32[] memory outputIdsOfInputs = new bytes32[](inputNumOfTheToken);
        uint sameTokenIndex = 0;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (exit.inputs[i].token == token && !exit.isInputEmpty(i)) {
                outputIdsOfInputs[sameTokenIndex] = exit.inputs[i].outputId;
                sameTokenIndex++;
            }
        }
        return framework.isAnyOutputFinalized(outputIdsOfInputs);
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
        address token
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
        framework.batchFlagOutputsFinalized(outputIdsToFlag);
    }

    function flagOutputsWhenCanonical(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        address token
    )
        private
    {
        uint256 inputNumOfTheToken;
        for (uint16 i = 0; i < exit.inputs.length; i++) {
            if (exit.inputs[i].token == token && !exit.isInputEmpty(i)) {
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
            if (exit.inputs[i].token == token && !exit.isInputEmpty(i)) {
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
        framework.batchFlagOutputsFinalized(outputIdsToFlag);
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
