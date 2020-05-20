pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";

library PaymentProcessStandardExit {
    struct Controller {
        PlasmaFramework framework;
        EthVault ethVault;
        Erc20Vault erc20Vault;
        uint256 safeGasStipend;
    }

    event ExitOmitted(
        uint168 indexed exitId
    );

    event ExitFinalized(
        uint168 indexed exitId
    );

    event BondReturnFailed(
        address indexed receiver,
        uint256 amount
    );

    /**
     * @notice Main logic function to process standard exit
     * @dev emits ExitOmitted event if the exit is omitted
     * @dev emits ExitFinalized event if the exit is processed and funds are withdrawn
     * @param self The controller struct
     * @param exitMap The storage of all standard exit data
     * @param exitId The exitId of the standard exit
     * @param token The ERC20 token address of the exit. Uses address(0) to represent ETH.
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        uint168 exitId,
        address token
    )
        public
    {
        PaymentExitDataModel.StandardExit memory exit = exitMap.exits[exitId];

        if (!exit.exitable || self.framework.isOutputFinalized(exit.outputId)) {
            emit ExitOmitted(exitId);
            delete exitMap.exits[exitId];
            return;
        }

        self.framework.flagOutputFinalized(exit.outputId, exitId);

        // we do not want to block a queue if bond return is unsuccessful
        bool success = SafeEthTransfer.transferReturnResult(exit.exitTarget, exit.bondSize, self.safeGasStipend);
        if (!success) {
            emit BondReturnFailed(exit.exitTarget, exit.bondSize);
        }

        if (token == address(0)) {
            self.ethVault.withdraw(exit.exitTarget, exit.amount);
        } else {
            self.erc20Vault.withdraw(exit.exitTarget, token, exit.amount);
        }

        delete exitMap.exits[exitId];

        emit ExitFinalized(exitId);
    }
}
