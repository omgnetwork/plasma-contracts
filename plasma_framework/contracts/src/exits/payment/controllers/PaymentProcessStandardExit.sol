pragma solidity ^0.5.0;
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
        uint256 standardExitBond;
    }

    event ExitOmitted(
        uint192 indexed exitId
    );

    event ExitFinalized(
        uint192 indexed exitId
    );

    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        uint192 exitId
    )
        public
    {
        PaymentExitDataModel.StandardExit memory exit = exitMap.exits[exitId];

        if (!exit.exitable || self.framework.isOutputSpent(exit.outputId)) {
            emit ExitOmitted(exitId);
            return;
        }

        self.framework.flagOutputSpent(exit.outputId);

        exit.exitTarget.transfer(self.standardExitBond);
        if (exit.token == address(0)) {
            self.ethVault.withdraw(exit.exitTarget, exit.amount);
        } else {
            self.erc20Vault.withdraw(exit.exitTarget, exit.token, exit.amount);
        }

        delete exitMap.exits[exitId];

        emit ExitFinalized(exitId);
    }
}
