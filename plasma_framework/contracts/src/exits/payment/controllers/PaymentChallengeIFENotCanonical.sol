pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../utils/MoreVpFinalization.sol";
import "../../../utils/PosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/GenericTransaction.sol";

library PaymentChallengeIFENotCanonical {
    using PosLib for PosLib.Position;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    /**
     * @dev supportedTxType Allows reuse of code in different Payment Tx versions
     */
    struct Controller {
        PlasmaFramework framework;
        SpendingConditionRegistry spendingConditionRegistry;
        uint256 supportedTxType;
    }

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 indexed txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitChallengeResponded(
        address indexed challenger,
        bytes32 indexed txHash,
        uint256 challengeTxPosition
    );

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentChallengeIFENotCanonical
     */
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
            spendingConditionRegistry: spendingConditionRegistry,
            supportedTxType: supportedTxType
        });
    }

    /**
     * @notice Main logic implementation for 'challengeInFlightExitNotCanonical'
     * @dev emits InFlightExitChallenged event on success
     * @param self The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param args Arguments of 'challengeInFlightExitNotCanonical' function from client
     */
    function challenge(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args
    )
        public
    {
        uint160 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-flight exit does not exist");

        require(ife.isInFirstPhase(self.framework.minExitPeriod()),
                "Canonicity challege phase for this exit has ended");

        require(
            keccak256(args.inFlightTx) != keccak256(args.competingTx),
            "The competitor transaction is the same as transaction in-flight"
        );

        PosLib.Position memory inputUtxoPos = PosLib.decode(args.inputUtxoPos);

        bytes32 outputId;
        if (self.framework.isDeposit(inputUtxoPos.blockNum)) {
            outputId = OutputId.computeDepositOutputId(args.inputTx, inputUtxoPos.outputIndex, args.inputUtxoPos);
        } else {
            outputId = OutputId.computeNormalOutputId(args.inputTx, inputUtxoPos.outputIndex);
        }
        require(outputId == ife.inputs[args.inFlightTxInputIndex].outputId,
                "Provided inputs data does not point to the same outputId from the in-flight exit");

        GenericTransaction.Output memory output = GenericTransaction.getOutput(
            GenericTransaction.decode(args.inputTx),
            inputUtxoPos.outputIndex
        );

        ISpendingCondition condition = self.spendingConditionRegistry.spendingConditions(
            output.outputType, self.supportedTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bool isSpentByCompetingTx = condition.verify(
            args.inputTx,
            inputUtxoPos.encode(),
            args.competingTx,
            args.competingTxInputIndex,
            args.competingTxWitness
        );
        require(isSpentByCompetingTx, "Competing input spending condition is not met");

        // Determine the position of the competing transaction
        uint256 competitorPosition = verifyCompetingTxFinalized(self, args);

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

    /**
     * @notice Main logic implementation for 'respondToNonCanonicalChallenge'
     * @dev emits InFlightExitChallengeResponded event on success
     * @param self The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param inFlightTx The in-flight tx, in RLP-encoded bytes
     * @param inFlightTxPos The UTXO position of the in-flight exit. Should hardcode 0 for the outputIndex.
     * @param inFlightTxInclusionProof Inclusion proof for the in-flight tx
     */
    function respond(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        bytes memory inFlightTx,
        uint256 inFlightTxPos,
        bytes memory inFlightTxInclusionProof
    )
        public
    {
        uint160 exitId = ExitId.getInFlightExitId(inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-flight exit does not exist");

        require(
            ife.oldestCompetitorPosition > inFlightTxPos,
            "In-flight transaction must be older than competitors to respond to non-canonical challenge");

        PosLib.Position memory utxoPos = PosLib.decode(inFlightTxPos);
        (bytes32 root, ) = self.framework.blocks(utxoPos.blockNum);
        require(root != bytes32(""), "Failed to get the block root hash of the UTXO position");

        ife.oldestCompetitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
            inFlightTx, utxoPos, root, inFlightTxInclusionProof
        );

        ife.isCanonical = true;
        ife.bondOwner = msg.sender;

        emit InFlightExitChallengeResponded(msg.sender, keccak256(inFlightTx), inFlightTxPos);
    }

    function verifyAndDeterminePositionOfTransactionIncludedInBlock(
        bytes memory txbytes,
        PosLib.Position memory utxoPos,
        bytes32 root,
        bytes memory inclusionProof
    )
        private
        pure
        returns (uint256)
    {
        require(
            Merkle.checkMembership(txbytes, utxoPos.txIndex, root, inclusionProof),
            "Transaction is not included in block of Plasma chain"
        );

        return utxoPos.encode();
    }

    function verifyCompetingTxFinalized(
        Controller memory self,
        PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args
    )
        private
        view
        returns (uint256)
    {
        // default to infinite low priority position
        uint256 competitorPosition = ~uint256(0);

        if (args.competingTxPos == 0) {
            bool isProtocolFinalized = MoreVpFinalization.isProtocolFinalized(
                self.framework,
                args.competingTx
            );
            // MoreVP protocol finalization would only return false only when tx does not exists.
            // Should fail already in early stages (eg. decode)
            assert(isProtocolFinalized);
        } else {
            PosLib.Position memory competingTxUtxoPos = PosLib.decode(args.competingTxPos);
            bool isStandardFinalized = MoreVpFinalization.isStandardFinalized(
                self.framework,
                args.competingTx,
                competingTxUtxoPos.toStrictTxPos(),
                args.competingTxInclusionProof
            );
            require(isStandardFinalized, "Competing tx is not standard finalized with the given tx position");
            competitorPosition = competingTxUtxoPos.encode();
        }
        return competitorPosition;
    }
}
