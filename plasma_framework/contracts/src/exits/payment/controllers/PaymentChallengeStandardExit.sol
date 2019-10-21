pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../models/OutputGuardModel.sol";
import "../../models/TxFinalizationModel.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/OutputId.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/IsDeposit.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/WireTransaction.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";

library PaymentChallengeStandardExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        ITxFinalizationVerifier txFinalizationVerifier;
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
    }

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentChallengeStandardExit
     */
    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        ITxFinalizationVerifier txFinalizationVerifier
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            spendingConditionRegistry: spendingConditionRegistry,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            txFinalizationVerifier: txFinalizationVerifier
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
        ChallengeStandardExitData memory data = ChallengeStandardExitData({
            controller: self,
            args: args,
            exitData: exitMap.exits[args.exitId]
        });
        verifyChallengeExitExists(data);
        verifyChallengeTxProtocolFinalized(data);
        verifySpendingCondition(data);

        delete exitMap.exits[args.exitId];
        // solhint-disable-next-line avoid-call-value
        (bool success, ) = msg.sender.call.value(data.exitData.bondSize)("");
        require(success, "Paying out bond failed");

        emit ExitChallenged(data.exitData.utxoPos);
    }

    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "The exit does not exist");
    }

    function verifyChallengeTxProtocolFinalized(ChallengeStandardExitData memory data) private view {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        PaymentOutputModel.Output memory output = PaymentTransactionModel
            .decode(data.args.exitingTx)
            .outputs[utxoPos.outputIndex()];

        IOutputGuardHandler outputGuardHandler = data.controller
                                                .outputGuardHandlerRegistry
                                                .outputGuardHandlers(output.outputType);

        require(address(outputGuardHandler) != address(0), "Failed to retrieve the outputGuardHandler of the output type");

        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            preimage: data.args.outputGuardPreimage
        });
        require(outputGuardHandler.isValid(outputGuardData),
                "Output guard information is invalid");

        uint256 challengeTxType = WireTransaction.getTransactionType(data.args.challengeTx);
        uint8 protocol = data.controller.framework.protocols(challengeTxType);
        TxFinalizationModel.Data memory finalizationData = TxFinalizationModel.Data({
            framework: data.controller.framework,
            protocol: protocol,
            txBytes: data.args.challengeTx,
            txPos: TxPosLib.TxPos(data.args.challengeTxPos),
            inclusionProof: data.args.challengeTxInclusionProof,
            confirmSig: data.args.challengeTxConfirmSig,
            confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
        });
        require(data.controller.txFinalizationVerifier.isProtocolFinalized(finalizationData),
                "Challenge transaction is not protocol finalized");
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        PaymentOutputModel.Output memory output = PaymentTransactionModel
            .decode(args.exitingTx)
            .outputs[utxoPos.outputIndex()];

        uint256 challengeTxType = WireTransaction.getTransactionType(args.challengeTx);
        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            output.outputType, challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bytes32 outputId = data.controller.isDeposit.test(utxoPos.blockNum())
                ? OutputId.computeDepositOutputId(args.exitingTx, utxoPos.outputIndex(), utxoPos.value)
                : OutputId.computeNormalOutputId(args.exitingTx, utxoPos.outputIndex());
        require(outputId == data.exitData.outputId, "Invalid exiting tx causing outputId mismatch");
        bool isSpentByChallengeTx = condition.verify(
            args.exitingTx,
            utxoPos.outputIndex(),
            utxoPos.txPos().value,
            args.challengeTx,
            args.inputIndex,
            args.witness,
            args.spendingConditionOptionalArgs
        );
        require(isSpentByChallengeTx, "Spending condition failed");
    }
}
