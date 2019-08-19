pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../spendingConditions/IPaymentSpendingCondition.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";

library PaymentChallengeStandardExit {
    struct Controller {
        PlasmaFramework framework;
        PaymentSpendingConditionRegistry spendingConditionRegistry;
        uint256 standardExitBond;
    }

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    /**
     * @dev data to be passed around helper functions
     */
    struct ChallengeStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args;
        PaymentExitDataModel.StandardExit exitData;
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args
    )
        public
    {
        ChallengeStandardExitData memory data = ChallengeStandardExitData({
            controller: self,
            args: args,
            exitData: exitMap.exits[args.exitId]
        });
        verifyChallengeExitExists(data);
        verifyOutputTypeAndGuardHash(data);
        verifySpendingCondition(data);

        delete exitMap.exits[args.exitId];
        msg.sender.transfer(self.standardExitBond);

        emit ExitChallenged(data.exitData.utxoPos);
    }


    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "Such exit does not exist");
    }

    function verifyOutputTypeAndGuardHash(ChallengeStandardExitData memory data) private pure {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;
        bytes32 outputTypeAndGuardHash = keccak256(
            abi.encodePacked(args.outputType, args.outputGuard)
        );

        require(data.exitData.outputTypeAndGuardHash == outputTypeAndGuardHash,
                "Either output type or output guard of challenge input args is invalid for the exit");
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;

        IPaymentSpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            args.outputType, args.challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bool isSpentByChallengeTx = condition.verify(
            args.outputGuard,
            data.exitData.utxoPos,
            data.exitData.outputId,
            args.challengeTx,
            args.inputIndex,
            args.witness
        );
        require(isSpentByChallengeTx, "Spending condition failed");
    }
}
