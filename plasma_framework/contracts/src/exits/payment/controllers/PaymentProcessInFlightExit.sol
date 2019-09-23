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

    event InFlightExitOutputWithdrawn(
        uint192 indexed exitId,
        uint16 outputIndex
    );

    event InFlightExitInputWithdrawn(
        uint192 indexed exitId,
        uint16 inputIndex
    );

    /**
     * @notice Main logic function to process in-flight exit
     * @dev emits InFlightExitOmitted event if the exit is omitted
     * @dev emits InFlightExitInputWithdrawn event if the input of IFE is withdrawn successfully
     * @dev emits InFlightExitOutputWithdrawn event if the output of IFE is withdrawn successfully
     * @param self the controller struct
     * @param exitMap the storage of all in-flight exit data
     * @param exitId the exitId of the in-flight exit
     * @param token the ERC20 token address of the exit. Uses address(0) to represent ETH.
     */
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
        if (exit.exitStartTimestamp == 0 || isAnyInputSpent(self.framework, exit, token)) {
            emit InFlightExitOmitted(exitId, token);
            return;
        }

        if (!exit.isCanonical) {
            for (uint16 i = 0; i < MAX_INPUT_NUM; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.inputs[i];

                if (shouldWithdrawInput(exit, withdrawal, token, i)) {
                    withdrawFromVault(self, withdrawal);
                    withdrawal.exitTarget.transfer(withdrawal.piggybackBondSize);
                    emit InFlightExitInputWithdrawn(exitId, i);
                }
            }
        } else {
            for (uint16 i = 0; i < MAX_OUTPUT_NUM; i++) {
                PaymentExitDataModel.WithdrawData memory withdrawal = exit.outputs[i];

                if (shouldWithdrawOutput(self, exit, withdrawal, token, i)) {
                    withdrawFromVault(self, withdrawal);
                    withdrawal.exitTarget.transfer(withdrawal.piggybackBondSize);
                    emit InFlightExitOutputWithdrawn(exitId, i);
                }
            }
        }

        flagInputsAndOutputsSpent(self.framework, exit, token);
        clearPiggybackInputFlag(exit, token);
        clearPiggybackOutputFlag(exit, token);

        if (allPiggybacksCleared(exit)) {
            exit.bondOwner.transfer(exit.bondSize);
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
        for (uint i = 0; i < MAX_INPUT_NUM; i++) {
            if (exit.inputs[i].token == token) {
                inputNumOfTheToken++;
            }
        }
        bytes32[] memory outputIdsOfInputs = new bytes32[](inputNumOfTheToken);
        uint sameTokenIndex = 0;
        for (uint i = 0; i < MAX_INPUT_NUM; i++) {
            if (exit.inputs[i].token == token) {
                outputIdsOfInputs[sameTokenIndex] = exit.inputs[i].outputId;
                sameTokenIndex++;
            }
        }
        return framework.isAnyOutputsSpent(outputIdsOfInputs);
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
        // whether input is spent is already checked all together in 'isAnyInputSpent'
        // thus do not need to re-check here.
        return withdrawal.token == token &&
                exit.isInputPiggybacked(index);
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

    function flagInputsAndOutputsSpent(
        PlasmaFramework framework,
        PaymentExitDataModel.InFlightExit memory exit,
        address token
    )
        private
    {
        // we flag _all_ inputs no matter it is piggybacked or not
        // if exiting from output, all inputs are consider spent and can only exit from output furthre on.
        // if exiting from input, for simplicity, we force all users to piggyback the input together at once
        // instead of re-start the IFE and re-piggyback their input.
        uint256 inputNumOfTheToken;
        for (uint16 i = 0; i < MAX_INPUT_NUM; i++) {
            if (exit.inputs[i].token == token) {
                inputNumOfTheToken++;
            }
        }

        // only the piggybacked outputs are flagged. User can still standard exit if non-piggybacked.
        uint256 piggybackedOutputNumOfTheToken;
        for (uint16 i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (exit.outputs[i].token == token && exit.isOutputPiggybacked(i)) {
                piggybackedOutputNumOfTheToken++;
            }
        }

        bytes32[] memory outputIdsToFlag = new bytes32[](inputNumOfTheToken + piggybackedOutputNumOfTheToken);
        uint indexForOutputIds = 0;
        for (uint16 i = 0; i < MAX_INPUT_NUM; i++) {
            if (exit.inputs[i].token == token) {
                outputIdsToFlag[indexForOutputIds] = exit.inputs[i].outputId;
                indexForOutputIds++;
            }
        }
        for (uint16 i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (exit.outputs[i].token == token && exit.isOutputPiggybacked(i)) {
                outputIdsToFlag[indexForOutputIds] = exit.outputs[i].outputId;
                indexForOutputIds++;
            }
        }
        framework.batchFlagOutputsSpent(outputIdsToFlag);
    }

    function clearPiggybackInputFlag(
        PaymentExitDataModel.InFlightExit storage exit,
        address token
    )
        private
    {
        for (uint16 i = 0; i < MAX_INPUT_NUM; i++) {
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
        for (uint16 i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (token == exit.outputs[i].token) {
                exit.clearOutputPiggybacked(i);
            }
        }
    }

    function allPiggybacksCleared(PaymentExitDataModel.InFlightExit memory exit) private pure returns (bool) {
        for (uint16 i = 0; i < MAX_INPUT_NUM; i++) {
            if (exit.isInputPiggybacked(i))
                return false;
        }

        for (uint16 i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (exit.isOutputPiggybacked(i))
                return false;
        }

        return true;
    }
}
