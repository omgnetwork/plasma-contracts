pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../models/TxFinalizationModel.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../../utils/Merkle.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../transactions/WireTransaction.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFEOutputSpent {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        SpendingConditionRegistry spendingConditionRegistry;
        ITxFinalizationVerifier txFinalizationVerifier;
        uint256 safeGasStipend;
    }

    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 indexed txHash,
        uint16 outputIndex
    );

    /**
     * @notice Main logic implementation for 'challengeInFlightExitOutputSpent'
     * @dev emits InFlightExitOutputBlocked event on success
     * @param controller The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param args Arguments of 'challengeInFlightExitOutputSpent' function from client
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
        require(ife.exitStartTimestamp != 0, "In-flight exit does not exist");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.outputUtxoPos);
        uint16 outputIndex = UtxoPosLib.outputIndex(utxoPos);
        require(
            ife.isOutputPiggybacked(outputIndex),
            "Output is not piggybacked"
        );

        verifyInFlightTransactionStandardFinalized(controller, args);
        verifyChallengingTransactionSpendsOutput(controller, args);

        ife.clearOutputPiggybacked(outputIndex);

        uint256 piggybackBondSize = ife.outputs[outputIndex].piggybackBondSize;
        SafeEthTransfer.transferRevertOnError(msg.sender, piggybackBondSize, controller.safeGasStipend);

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

    function verifyChallengingTransactionSpendsOutput(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        private
        view
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.outputUtxoPos);
        uint256 challengingTxType = WireTransaction.getTransactionType(args.challengingTx);
        WireTransaction.Output memory output = WireTransaction.getOutput(args.challengingTx, utxoPos.outputIndex());

        ISpendingCondition condition = controller.spendingConditionRegistry.spendingConditions(
            output.outputType,
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

        require(isSpentBySpendingTx, "Challenging transaction does not spend the output");
    }
}
