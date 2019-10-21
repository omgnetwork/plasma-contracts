pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";

library PaymentProcessStandardExit {
    struct Controller {
        PlasmaFramework framework;
        EthVault ethVault;
        Erc20Vault erc20Vault;
    }

    event ExitOmitted(
        uint160 indexed exitId
    );

    event ExitFinalized(
        uint160 indexed exitId
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
        uint160 exitId,
        address token
    )
        public
    {
        PaymentExitDataModel.StandardExit memory exit = exitMap.exits[exitId];

        if (!exit.exitable || self.framework.isOutputSpent(exit.outputId)) {
            emit ExitOmitted(exitId);
            return;
        }

        self.framework.flagOutputSpent(exit.outputId);

        // we do not want to block a queue if bond return is unsuccessful
        // solhint-disable-next-line avoid-call-value
        (bool success, ) = exit.exitTarget.call.value(exit.bondSize)("");
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
