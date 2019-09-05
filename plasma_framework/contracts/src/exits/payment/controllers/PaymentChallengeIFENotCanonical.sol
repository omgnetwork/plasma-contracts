pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../spendingConditions/IPaymentSpendingCondition.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFENotCanonical {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    struct Controller {
        PlasmaFramework framework;
        PaymentSpendingConditionRegistry spendingConditionRegistry;
        uint256 supportedTxType;
    }

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitChallengeResponded(
        address challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-fligh exit doesn't exists");

        verifyFirstPhaseNotOver(ife, self.framework.minExitPeriod());

        require(
            keccak256(args.inFlightTx) != keccak256(args.competingTx),
            "The competitor transaction is the same as transaction in-flight"
        );

        IPaymentSpendingCondition condition = self.spendingConditionRegistry.spendingConditions(
            args.competingTxInputOutputType, self.supportedTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        // FIXME: move to the finalized interface as https://github.com/omisego/plasma-contracts/issues/214
        // Also, the tests should verify the args correctness
        bool isSpentByInFlightTx = condition.verify(
            bytes32(''), // tmp solution, we don't need outputGuard anymore for the interface of :point-up: GH-214
            uint256(0), // should not be used
            ife.inputs[args.inFlightTxInputIndex].outputId,
            args.competingTx,
            args.competingTxInputIndex,
            args.competingTxWitness
        );
        require(isSpentByInFlightTx, "Competing input spending condition is not met");

        // Determine the position of the competing transaction
        uint256 competitorPosition = ~uint256(0);
        if (args.competingTxPos != 0) {
            UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.competingTxPos);
            (bytes32 root, ) = self.framework.blocks(utxoPos.blockNum());
            competitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
                args.competingTx, utxoPos, root, args.competingTxInclusionProof
            );
        }

        require(
            ife.oldestCompetitorPosition == 0 || ife.oldestCompetitorPosition > competitorPosition,
            "Competing transaction is not older than already known competitor"
        );

        ife.oldestCompetitorPosition = competitorPosition;
        ife.bondOwner = msg.sender;

        // Set a flag so that only the inputs are exitable, unless a response is received.
        ife.isCanonical = false;

        emit InFlightExitChallenged(msg.sender, keccak256(args.inFlightTx), competitorPosition);
    }

    function respond(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        bytes memory inFlightTx,
        uint256 inFlightTxPos,
        bytes memory inFlightTxInclusionProof
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-fligh exit doesn't exists");

        require(
            ife.oldestCompetitorPosition > inFlightTxPos,
            "In-flight transaction has to be older than competitors to respond to noncanonical challenge.");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(inFlightTxPos);
        (bytes32 root, ) = self.framework.blocks(utxoPos.blockNum());
        ife.oldestCompetitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
            inFlightTx, utxoPos, root, inFlightTxInclusionProof
        );

        ife.isCanonical = true;
        ife.bondOwner = msg.sender;

        emit InFlightExitChallengeResponded(msg.sender, keccak256(inFlightTx), inFlightTxPos);
    }

    /**
     * @dev Checks that in-flight exit is in phase that allows for piggybacks and canonicity challenges.
     * @param ife in-flight exit to check.
     */
    function verifyFirstPhaseNotOver(
        PaymentExitDataModel.InFlightExit storage ife,
        uint256 minExitPeriod
    )
        private
        view
    {
        uint256 phasePeriod = minExitPeriod / 2;
        bool firstPhasePassed = ((block.timestamp - ife.exitStartTimestamp) / phasePeriod) >= 1;
        require(!firstPhasePassed, "Canonicity challege phase for this exit has ended");
    }

    function verifyAndDeterminePositionOfTransactionIncludedInBlock(
        bytes memory txbytes,
        UtxoPosLib.UtxoPos memory utxoPos,
        bytes32 root,
        bytes memory inclusionProof
    )
        private
        pure
        returns(uint256)
    {
        bytes32 leaf = keccak256(txbytes);
        require(
            Merkle.checkMembership(leaf, utxoPos.txIndex(), root, inclusionProof),
            "Transaction is not included in block of plasma chain"
        );

        return utxoPos.value;
    }
}
