pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/MoreVpFinalization.sol";
import "../../utils/OutputId.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/Protocol.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../utils/PosLib.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/GenericTransaction.sol";

library PaymentChallengeStandardExit {
    using PosLib for PosLib.Position;
    using PaymentTransactionModel for PaymentTransactionModel.Transaction;

    struct Controller {
        PlasmaFramework framework;
        SpendingConditionRegistry spendingConditionRegistry;
        uint256 safeGasStipend;
    }

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    /**
     * @dev Data to be passed around helper functions
     */
    struct ChallengeStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args;
        PaymentExitDataModel.StandardExit exitData;
        uint256 challengeTxType;
    }

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentChallengeStandardExit
     */
    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        uint256 safeGasStipend
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            spendingConditionRegistry: spendingConditionRegistry,
            safeGasStipend: safeGasStipend
        });
    }

    /**
     * @notice Main logic function to challenge standard exit
     * @dev emits ExitChallenged event on success
     * @param self The controller struct
     * @param exitMap The storage of all standard exit data
     * @param args Arguments of challenge standard exit function from client
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args
    )
        public
    {
        GenericTransaction.Transaction memory challengeTx = GenericTransaction.decode(args.challengeTx);

        ChallengeStandardExitData memory data = ChallengeStandardExitData({
            controller: self,
            args: args,
            exitData: exitMap.exits[args.exitId],
            challengeTxType: challengeTx.txType
        });
        verifyChallengeExitExists(data);
        verifyChallengeTxProtocolFinalized(data);
        verifySpendingCondition(data);

        exitMap.exits[args.exitId].exitable = false;

        SafeEthTransfer.transferRevertOnError(msg.sender, data.exitData.bondSize, self.safeGasStipend);

        emit ExitChallenged(data.exitData.utxoPos);
    }

    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "The exit does not exist");
    }

    function verifyChallengeTxProtocolFinalized(ChallengeStandardExitData memory data) private view {
        bool isProtocolFinalized = MoreVpFinalization.isProtocolFinalized(data.controller.framework, data.args.challengeTx);
        // MoreVP protocol finalization would only return false only when tx does not exists.
        // Should fail already in early stages (eg. decode)
        assert(isProtocolFinalized);
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;

        PosLib.Position memory utxoPos = PosLib.decode(data.exitData.utxoPos);
        FungibleTokenOutputModel.Output memory output = PaymentTransactionModel
            .decode(args.exitingTx)
            .getOutput(utxoPos.outputIndex);

        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            output.outputType, data.challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bytes32 outputId = data.controller.framework.isDeposit(utxoPos.blockNum)
                ? OutputId.computeDepositOutputId(args.exitingTx, utxoPos.outputIndex, utxoPos.encode())
                : OutputId.computeNormalOutputId(args.exitingTx, utxoPos.outputIndex);
        require(outputId == data.exitData.outputId, "Invalid exiting tx causing outputId mismatch");

        bool isSpentByChallengeTx = condition.verify(
            args.exitingTx,
            utxoPos.encode(),
            args.challengeTx,
            args.inputIndex,
            args.witness
        );
        require(isSpentByChallengeTx, "Spending condition failed");
    }
}
