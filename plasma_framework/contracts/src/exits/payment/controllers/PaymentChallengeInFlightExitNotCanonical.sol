pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../spendingConditions/IPaymentSpendingCondition.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";

library PaymentChallengeInFlightExitNotCanonical {
    struct Controller {

    }

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    function buildController() public {

    }

    function run(PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args) public {
        // Check if there is an active in-flight exit from this transaction?
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExits[exitId];
        require(ife.exitStartTimestamp != 0, "In-fligh exit doesn't exists");

        // Check that the exit is active and in period 1
        verifyFirstPhaseNotOver(ife);
        // Check if exit's input was spent via MVP exit
        verifyInputNotSpent(ife);

        // Check that two transactions are not the same
        require(
            keccak256(args.inFlightTx) != keccak256(args.competingTx),
            "The competitor transaction is the same as transaction in-flight"
        );

        // Check that both transactions share the same input
        PaymentTransactionModel.Transaction memory inFlight = PaymentTransactionModel.decode(args.inFlightTx);
        PaymentTransactionModel.Transaction memory competitor = PaymentTransactionModel.decode(args.competingTx);
        require(
            inFlight.inputs[args.inFlightTxInputIndex] == competitor.inputs[args.competingTxInputIndex],
            "The competitor and transcation in-flight have to share input at given positions"
        );

        // Check that shared input owner signes competing transaction
        require(
            isSpendingConditionMet(
                ife.inputs[args.inFlightTxInputIndex].outputGuard,
                args.competingTxInputPos,
                args.competingTxInputOutputId,
                args.competingTxInputOutputType,
                args.competingTx,
                competitor.txType,
                args.competingTxInputIndex,
                args.competingTxWitness
            ),
            "Competing input spending condition is not met"
        );

        // Determine the position of the competing transaction.
        uint256 competitorPosition = ~uint256(0);
        if (args.competingTxPos != 0) {
            UtxoPosLib.UtxoPos memory competingUtxoPos = UtxoPosLib.UtxoPos(args.competingTxPos);
            (bytes32 root, ) = framework.blocks(competingUtxoPos.blockNum());
            require(
                Merkle.checkMembership(keccak256(args.competingTx), competingUtxoPos.txIndex(), root, args.competingTxInclusionProof),
                "Competing transaction is not included in plasma chain"
            );
            competitorPosition = args.competingTxPos;
        }

        // Competitor must be first or must be older than the current oldest competitor.
        require(
            ife.oldestCompetitorPosition == 0 || ife.oldestCompetitorPosition > competitorPosition,
            "Competing transaction is not older than already known competitor"
        );

        ife.oldestCompetitorPosition = competitorPosition;
        ife.bondOwner = msg.sender;

        // Set a flag so that only the inputs are exitable, unless a response is received.
        setNonCanonicalChallenge(ife);

        emit InFlightExitChallenged(msg.sender, keccak256(args.inFlightTx), competitorPosition);
    }

    function isSpendingConditionMet(
        bytes32 outputGuard,
        uint256 utxoPos,
        bytes32 outputId,
        uint256 outputType,
        bytes memory spendingTx,
        uint256 spendingTxType,
        uint8 inputIndex,
        bytes memory witness
    ) private view returns(bool) {
        //FIXME: consider moving spending conditions to PlasmaFramework
        IPaymentSpendingCondition condition = PaymentSpendingConditionRegistry
            .spendingConditions(outputType, spendingTxType);
        require(address(condition) != address(0), "Spending condition contract not found");

        return condition.verify(outputGuard, utxoPos, outputId, spendingTx, inputIndex, witness);
    }

    /**
     * @dev Checks that in-flight exit is in phase that allows for piggybacks and canonicity challenges.
     * @param ife in-flight exit to check.
     */
    function verifyFirstPhaseNotOver(PaymentExitDataModel.InFlightExit storage ife) private view {
        uint256 phasePeriod = framework.minExitPeriod() / 2;
        bool firstPhasePassed = ((block.timestamp - getInFlightExitTimestamp(ife)) / phasePeriod) >= 1;
        require(firstPhasePassed, "Canonicity challege phase for this exit has ended");
    }

    function verifyInputNotSpent(PaymentExitDataModel.InFlightExit storage ife) private view {
        bool _isSpent = ife.exitStartTimestamp.bitSet(254);
        require(!_isSpent, "Input was already spent");
    }

    function setNonCanonicalChallenge(PaymentExitDataModel.InFlightExit storage ife)
        private
    {
        ife.exitStartTimestamp = ife.exitStartTimestamp.setBit(255);
    }

    function verifyAndDeterminePositionOfTransactionIncludedInBlock(
        bytes memory txbytes,
        UtxoPosLib.UtxoPos memory utxoPos,
        bytes memory inclusionProof
    ) private view returns(uint256) {
        (bytes32 root, ) = framework.blocks(utxoPos.blockNum());
        bytes32 leaf = keccak256(txbytes);
        require(
            Merkle.checkMembership(leaf, utxoPos.txIndex(), root, inclusionProof),
            "Transaction is not included in block of plasma chain"
        );

        return utxoPos.value;
    }
}