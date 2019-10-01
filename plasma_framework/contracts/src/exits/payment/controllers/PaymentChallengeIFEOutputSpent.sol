pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../models/OutputGuardModel.sol";
import "../../models/TxFinalizationModel.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/ExitId.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../transactions/WireTransaction.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFEOutputSpent {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        SpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        ITxFinalizationVerifier txFinalizationVerifier;
    }

    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 ifeTxHash,
        uint16 outputIndex
    );

    /**
     * @notice Main logic implementation for 'challengeInFlightExitOutputSpent'
     * @dev emits InFlightExitOutputBlocked event on success
     * @param controller the controller struct
     * @param inFlightExitMap the storage of all in-flight exit data
     * @param args arguments of 'challengeInFlightExitOutputSpent' function from client.
     */
    function run(
        Controller memory controller,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        public
    {
        uint160 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-flight exit doesn't exist");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.outputUtxoPos);
        uint16 outputIndex = UtxoPosLib.outputIndex(utxoPos);
        require(
            ife.isOutputPiggybacked(outputIndex),
            "Output is not piggybacked"
        );

        verifyInFlightTransactionStandardFinalized(controller, args);
        verifyOutputType(controller, args);
        verifyChallengingTransactionSpendsOutput(controller, args);

        ife.clearOutputPiggybacked(outputIndex);

        //pay bond to challenger
        msg.sender.transfer(ife.outputs[outputIndex].piggybackBondSize);
        emit InFlightExitOutputBlocked(msg.sender, keccak256(args.inFlightTx), outputIndex);
    }

    function verifyInFlightTransactionStandardFinalized(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        private
        view
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.outputUtxoPos);
        TxFinalizationModel.Data memory finalizationData = TxFinalizationModel.moreVpData(
            controller.framework,
            args.inFlightTx,
            utxoPos.txPos(),
            args.inFlightTxInclusionProof
        );

        require(controller.txFinalizationVerifier.isStandardFinalized(finalizationData), "In-flight transaction not finalized");
    }

    function verifyOutputType(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        private
        view
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.outputUtxoPos);
        uint16 outputIndex = UtxoPosLib.outputIndex(utxoPos);
        WireTransaction.Output memory output = WireTransaction.getOutput(args.inFlightTx, outputIndex);
        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: args.outputType,
            preimage: args.outputGuardPreimage
        });
        IOutputGuardHandler handler = controller.outputGuardHandlerRegistry
                                                .outputGuardHandlers(args.outputType);

        require(address(handler) != address(0),
            "Does not have outputGuardHandler registered for the output type");

        require(handler.isValid(outputGuardData),
            "Some of the output guard related information is not valid");
    }

    function verifyChallengingTransactionSpendsOutput(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        private
        view
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.outputUtxoPos);
        uint256 challengingTxType = WireTransaction.getTransactionType(args.challengingTx);

        ISpendingCondition condition = controller.spendingConditionRegistry.spendingConditions(
            args.outputType,
            challengingTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bool isSpentBySpendingTx = condition.verify(
            args.inFlightTx,
            utxoPos.outputIndex(),
            utxoPos.txPos().value,
            args.challengingTx,
            args.challengingTxInputIndex,
            args.challengingTxWitness,
            args.spendingConditionOptionalArgs
        );

        require(isSpentBySpendingTx, "Challenging transaction does not spent the output");
    }
}
