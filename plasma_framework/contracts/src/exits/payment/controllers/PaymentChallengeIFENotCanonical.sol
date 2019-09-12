pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../utils/IsDeposit.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";

library PaymentChallengeIFENotCanonical {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
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

    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        uint256 supportedTxType
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            spendingConditionRegistry: spendingConditionRegistry,
            supportedTxType: supportedTxType
        });
    }

    function challenge(
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

        ISpendingCondition condition = self.spendingConditionRegistry.spendingConditions(
            args.outputType, self.supportedTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        UtxoPosLib.UtxoPos memory inputUtxoPos = UtxoPosLib.UtxoPos(args.inputUtxoPos);
        bytes32 outputId = self.isDeposit.test(inputUtxoPos.blockNum())?
            OutputId.computeDepositOutputId(args.inputTx, inputUtxoPos.outputIndex(), inputUtxoPos.value)
            : OutputId.computeNormalOutputId(args.inputTx, inputUtxoPos.outputIndex());
        require(outputId == ife.inputs[args.inFlightTxInputIndex].outputId,
                "Provided inputs data does not point to the same outputId from the in-flight exit");

        bool isSpentByCompetingTx = condition.verify(
            args.inputTx,
            inputUtxoPos.outputIndex(),
            inputUtxoPos.txPos().value,
            args.competingTx,
            args.competingTxInputIndex,
            args.competingTxWitness,
            args.competingTxSpendingConditionOptionalArgs
        );
        require(isSpentByCompetingTx, "Competing input spending condition does not met");

        // Determine the position of the competing transaction
        uint256 competitorPosition = ~uint256(0);
        if (args.competingTxPos != 0) {
            UtxoPosLib.UtxoPos memory competingTxUtxoPos = UtxoPosLib.UtxoPos(args.competingTxPos);
            (bytes32 root, ) = self.framework.blocks(competingTxUtxoPos.blockNum());
            competitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
                args.competingTx, competingTxUtxoPos, root, args.competingTxInclusionProof
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
        require(ife.exitStartTimestamp != 0, "In-flight exit doesn't exists");

        require(
            ife.oldestCompetitorPosition > inFlightTxPos,
            "In-flight transaction has to be younger than competitors to respond to non-canonical challenge.");

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
