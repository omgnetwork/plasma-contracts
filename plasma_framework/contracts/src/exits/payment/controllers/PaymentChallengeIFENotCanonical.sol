pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../models/OutputGuardModel.sol";
import "../../models/TxFinalizationModel.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/Merkle.sol";
import "../../../utils/IsDeposit.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/WireTransaction.sol";

library PaymentChallengeIFENotCanonical {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    /**
     * @dev supportedTxType Allows reuse of code in different Payment Tx versions
     */
    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        ITxFinalizationVerifier txFinalizationVerifier;
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

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentChallengeIFENotCanonical
     */
    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        ITxFinalizationVerifier txFinalizationVerifier,
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
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            txFinalizationVerifier: txFinalizationVerifier,
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


        UtxoPosLib.UtxoPos memory inputUtxoPos = UtxoPosLib.UtxoPos(args.inputUtxoPos);

        bytes32 outputId;
        if (self.isDeposit.test(inputUtxoPos.blockNum())) {
            outputId = OutputId.computeDepositOutputId(args.inputTx, inputUtxoPos.outputIndex(), inputUtxoPos.value);
        } else {
            outputId = OutputId.computeNormalOutputId(args.inputTx, inputUtxoPos.outputIndex());
        }
        require(outputId == ife.inputs[args.inFlightTxInputIndex].outputId,
                "Provided inputs data does not point to the same outputId from the in-flight exit");

        WireTransaction.Output memory output = WireTransaction.getOutput(args.inputTx, args.inFlightTxInputIndex);

        ISpendingCondition condition = self.spendingConditionRegistry.spendingConditions(
            output.outputType, self.supportedTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");
        bool isSpentByCompetingTx = condition.verify(
            args.inputTx,
            inputUtxoPos.outputIndex(),
            inputUtxoPos.txPos().value,
            args.competingTx,
            args.competingTxInputIndex,
            args.competingTxWitness,
            args.competingTxSpendingConditionOptionalArgs
        );
        require(isSpentByCompetingTx, "Competing input spending condition is not met");

        // Determine the position of the competing transaction
        uint256 competitorPosition = verifyCompetingTxFinalized(self, args, output);

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
            "In-flight transaction must be younger than competitors to respond to non-canonical challenge");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(inFlightTxPos);
        (bytes32 root, ) = self.framework.blocks(utxoPos.blockNum());
        ife.oldestCompetitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
            inFlightTx, utxoPos, root, inFlightTxInclusionProof
        );

        ife.isCanonical = true;
        ife.bondOwner = msg.sender;

        emit InFlightExitChallengeResponded(msg.sender, keccak256(inFlightTx), inFlightTxPos);
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
            "Transaction is not included in block of Plasma chain"
        );

        return utxoPos.value;
    }

    function verifyCompetingTxFinalized(
        Controller memory self,
        PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args,
        WireTransaction.Output memory output
    )
        private
        view
        returns (uint256)
    {
        // default to infinite low priority position
        uint256 competitorPosition = ~uint256(0);

        UtxoPosLib.UtxoPos memory competingTxUtxoPos = UtxoPosLib.UtxoPos(args.competingTxPos);
        uint256 competingTxType = WireTransaction.getTransactionType(args.competingTx);
        uint8 protocol = self.framework.protocols(competingTxType);

        if (args.competingTxPos == 0) {
            // skip the verifier.isProtocolFinalized() for MoreVP since it only needs to check the existence of tx.
            require(protocol == Protocol.MORE_VP(), "Competing tx without position must be a MoreVP tx");
        } else {
            IOutputGuardHandler outputGuardHandler = self.outputGuardHandlerRegistry.outputGuardHandlers(output.outputType);
            require(address(outputGuardHandler) != address(0), "Failed to retrieve the outputGuardHandler of the output type");

            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
                guard: output.outputGuard,
                preimage: args.outputGuardPreimage
            });
            require(outputGuardHandler.isValid(outputGuardData), "Output guard information is invalid");

            TxFinalizationModel.Data memory finalizationData = TxFinalizationModel.Data({
                framework: self.framework,
                protocol: protocol,
                txBytes: args.competingTx,
                txPos: competingTxUtxoPos.txPos(),
                inclusionProof: args.competingTxInclusionProof,
                confirmSig: args.competingTxConfirmSig,
                confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
            });
            require(self.txFinalizationVerifier.isStandardFinalized(finalizationData), "Failed to verify the position of competing tx");

            competitorPosition = competingTxUtxoPos.value;
        }
        return competitorPosition;
    }
}
