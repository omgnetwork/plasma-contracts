pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";

library PaymentProcessInFlightExit {
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    uint8 public constant MAX_INPUT_NUM = 4;
    uint8 public constant MAX_OUTPUT_NUM = 4;

    struct Controller {
        PlasmaFramework framework;
        EthVault ethVault;
        Erc20Vault erc20Vault;
    }

    event InFlightExitOmitted(
        uint192 indexed exitId,
        address token
    );

    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage exitMap,
        uint192 exitId,
        address token
    )
        public
    {
        PaymentExitDataModel.InFlightExit storage exit = exitMap.exits[exitId];

        // check if any input spent already, this is required to prevent operator stealing fund.
        // Since process exit should not revert to avoid blocking the while loop, return directly.
        // see: https://github.com/omisego/plasma-contracts/issues/102#issuecomment-495809967
        if (isAnyInputSpent(self.framework, exit, token)) {
            emit InFlightExitOmitted(exitId, token);
            return;
        }

        if (exit.isCanonical) {
            for (uint16 i = 0 ; i < MAX_OUTPUT_NUM ; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.outputs[i];
                if (shouldWithdrawOutput(self, exit, withdrawal, token, i)) {
                    exit.clearOutputPiggybacked(i);
                    withdrawFromVault(self, withdrawal);
                    withdrawal.exitTarget.transfer(withdrawal.piggybackBondSize);
                }
            }
        } else {
            for (uint16 i = 0 ; i < MAX_INPUT_NUM ; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.inputs[i];
                if (shouldWithdrawInput(exit, withdrawal, token, i)) {
                    exit.clearInputPiggybacked(i);
                    withdrawFromVault(self, withdrawal);
                    withdrawal.exitTarget.transfer(withdrawal.piggybackBondSize);
                }
            }
        }

        exit.bondOwner.transfer(exit.bondSize);

        flagInputAndOutputSpent(self.framework, exit, token);

        // TODO: do we still need isFinalized?
        if (allPiggybackCleared(exit)) {
            exit.isFinalized = true;
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
        for (uint i = 0 ; i < MAX_INPUT_NUM ;  i++ ) {
            if (exit.inputs[i].token == token) {
                inputNumOfTheToken ++;
            }
        }
        bytes32[] memory outputIdsOfInputs = new bytes32[](inputNumOfTheToken);
        uint sameTokenIndex = 0;
        for (uint i = 0 ; i < MAX_INPUT_NUM ; i ++) {
            if (exit.inputs[i].token == token) {
                outputIdsOfInputs[sameTokenIndex] = exit.inputs[i].outputId;
                sameTokenIndex ++;
            }
        }
        return framework.isAnyOutputsSpent(outputIdsOfInputs);
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
                !controller.framework.isOutputSpent(withdrawal.outputId);
    }

    function shouldWithdrawInput(
        PaymentExitDataModel.InFlightExit memory exit,
        PaymentExitDataModel.WithdrawData memory withdrawal,
        address token,
        uint16 index
    )
        private
        pure
        returns (bool)
    {
        return withdrawal.token == token && exit.isInputPiggybacked(index);
    }

    function flagInputAndOutputSpent(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        address token
    )
        private
    {
        uint256 inputNumOfTheToken;
        for (uint16 i = 0 ; i < MAX_INPUT_NUM ;  i++ ) {
            if (exit.inputs[i].token == token) {
                inputNumOfTheToken ++;
            }
        }
        uint256 piggybackedOutputNumOfTheToken;
        for (uint16 i = 0 ; i < MAX_OUTPUT_NUM ;  i++ ) {
            if (exit.outputs[i].token == token && exit.isOutputPiggybacked(i)) {
                piggybackedOutputNumOfTheToken ++;
            }
        }

        bytes32[] memory outputIdsToFlag = new bytes32[](inputNumOfTheToken + piggybackedOutputNumOfTheToken);
        for (uint16 i = 0 ; i < MAX_INPUT_NUM ;  i++ ) {
            if (exit.inputs[i].token == token) {
                outputIdsToFlag[i] = exit.inputs[i].outputId;
            }
        }
        for (uint16 i = 0 ; i < MAX_OUTPUT_NUM ;  i++ ) {
            if (exit.outputs[i].token == token && exit.isOutputPiggybacked(i)) {
                outputIdsToFlag[i + inputNumOfTheToken] = exit.outputs[i].outputId;
            }
        }
        framework.batchFlagOutputsSpent(outputIdsToFlag);
    }

    function allPiggybackCleared(PaymentExitDataModel.InFlightExit memory exit) private pure returns (bool) {
        for (uint16 i = 0 ; i < MAX_INPUT_NUM ; i ++) {
            if (exit.isInputPiggybacked(i))
                return false;
        }

        for (uint16 i = 0 ; i < MAX_OUTPUT_NUM ; i ++) {
            if (exit.isOutputPiggybacked(i))
                return false;
        }

        return true;
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
}
