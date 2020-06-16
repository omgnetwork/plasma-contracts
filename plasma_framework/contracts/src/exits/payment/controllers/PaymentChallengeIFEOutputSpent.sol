pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../utils/MoreVpFinalization.sol";
import "../../../utils/Merkle.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../utils/PosLib.sol";
import "../../../transactions/GenericTransaction.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFEOutputSpent {
    using PosLib for PosLib.Position;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        SpendingConditionRegistry spendingConditionRegistry;
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
        require(args.senderData == keccak256(abi.encodePacked(msg.sender)), "Incorrect senderData");

        uint168 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-flight exit does not exist");

        PosLib.Position memory utxoPos = PosLib.decode(args.outputUtxoPos);
        uint16 outputIndex = utxoPos.outputIndex;
        require(
            ife.isOutputPiggybacked(outputIndex),
            "Output is not piggybacked"
        );

        verifyInFlightTransactionStandardFinalized(controller, args);
        verifyChallengingTransactionProtocolFinalized(controller, args);
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
        PosLib.Position memory utxoPos = PosLib.decode(args.outputUtxoPos);
        bool isStandardFinalized = MoreVpFinalization.isStandardFinalized(
            controller.framework,
            args.inFlightTx,
            utxoPos.toStrictTxPos(),
            args.inFlightTxInclusionProof
        );

        require(isStandardFinalized, "In-flight transaction must be standard finalized (included in Plasma) to be able to spend");
    }

    function verifyChallengingTransactionProtocolFinalized(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        private
        view
    {
        bool isProtocolFinalized = MoreVpFinalization.isProtocolFinalized(
            controller.framework,
            args.challengingTx
        );

        // MoreVP protocol finalization would only return false only when tx does not exists.
        // Should fail already in early stages (eg. decode)
        assert(isProtocolFinalized);
    }

    function verifyChallengingTransactionSpendsOutput(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.ChallengeOutputSpent memory args
    )
        private
        view
    {
        PosLib.Position memory utxoPos = PosLib.decode(args.outputUtxoPos);
        GenericTransaction.Transaction memory challengingTx = GenericTransaction.decode(args.challengingTx);

        GenericTransaction.Transaction memory ifeTx = GenericTransaction.decode(args.inFlightTx);
        GenericTransaction.Output memory ifeTxOutput = GenericTransaction.getOutput(ifeTx, utxoPos.outputIndex);

        ISpendingCondition condition = controller.spendingConditionRegistry.spendingConditions(
            ifeTxOutput.outputType,
            challengingTx.txType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bool isSpentBySpendingTx = condition.verify(
            args.inFlightTx,
            utxoPos.encode(),
            args.challengingTx,
            args.challengingTxInputIndex,
            args.challengingTxWitness
        );

        require(isSpentBySpendingTx, "Challenging transaction does not spend the output");
    }
}
