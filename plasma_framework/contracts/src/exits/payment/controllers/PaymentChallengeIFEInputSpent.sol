pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../models/OutputGuardModel.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../utils/TxFinalization.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/Merkle.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/WireTransaction.sol";

library PaymentChallengeIFEInputSpent {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
    }

    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint16 inputIndex
    );

    /**
     * @dev data to be passed around helper functions
     */
    struct ChallengeIFEData {
        Controller controller;
        PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args;
        PaymentExitDataModel.InFlightExit ife;
    }

    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            spendingConditionRegistry: spendingConditionRegistry,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry
        });
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];

        require(ife.exitStartTimestamp != 0, "In-flight exit doesn't exist");
        require(ife.isInputPiggybacked(args.inFlightTxInputIndex), "The indexed input has not been piggybacked");

        require(
            keccak256(args.inFlightTx) != keccak256(args.challengingTx),
            "The challenging transaction is the same as the in-flight transaction"
        );

        ChallengeIFEData memory data = ChallengeIFEData({
            controller: self,
            args: args,
            ife: inFlightExitMap.exits[exitId]
        });

        verifySpentInputEqualsIFEInput(data);
        verifyOutputType(data);
        verifyChallengingTransactionProtocolFinalized(data);
        verifySpendingCondition(data);

        // Remove the input from the piggyback map
        ife.clearInputPiggybacked(args.inFlightTxInputIndex);

        // Pay out the bond.
        msg.sender.transfer(ife.inputs[args.inFlightTxInputIndex].piggybackBondSize);

        emit InFlightExitInputBlocked(msg.sender, keccak256(args.inFlightTx), args.inFlightTxInputIndex);
    }

    function verifySpentInputEqualsIFEInput(ChallengeIFEData memory data) private pure {
        bytes32 ifeInputOutputId = data.ife.inputs[data.args.inFlightTxInputIndex].outputId;

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.args.inputUtxoPos);
        bytes32 challengingTxInputOutputId = data.controller.isDeposit.test(utxoPos.blockNum())
                ? OutputId.computeDepositOutputId(data.args.inputTx, utxoPos.outputIndex(), utxoPos.value)
                : OutputId.computeNormalOutputId(data.args.inputTx, utxoPos.outputIndex());

        require(ifeInputOutputId == challengingTxInputOutputId, "Spent input is not the same as piggybacked input");
    }

    function verifyOutputType(ChallengeIFEData memory data) private view {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.args.inputUtxoPos);
        uint16 outputIndex = utxoPos.outputIndex();
        WireTransaction.Output memory output = WireTransaction.getOutput(data.args.inputTx, outputIndex);
        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: data.args.challengingTxInputOutputType,
            preimage: data.args.challengingTxInputOutputGuardPreimage
        });
        IOutputGuardHandler handler = data.controller.outputGuardHandlerRegistry.outputGuardHandlers(data.args.challengingTxInputOutputType);

        require(address(handler) != address(0),
            "Does not have outputGuardHandler registered for the output type");

        require(handler.isValid(outputGuardData),
            "Some of the output guard related information is not valid");
    }

    function verifyChallengingTransactionProtocolFinalized(ChallengeIFEData memory data)
        private
        view
    {
        TxFinalization.Verifier memory finalizationVerifier = TxFinalization.moreVpVerifier(
            data.controller.framework,
            data.args.challengingTx,
            TxPosLib.TxPos(0),
            bytes("")
        );

        require(TxFinalization.isProtocolFinalized(finalizationVerifier), "Challenging transaction not finalized");
    }

    function verifySpendingCondition(ChallengeIFEData memory data) private view {
        uint256 challengingTxType = WireTransaction.getTransactionType(data.args.challengingTx);
        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            data.args.challengingTxInputOutputType, challengingTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        UtxoPosLib.UtxoPos memory inputUtxoPos = UtxoPosLib.UtxoPos(data.args.inputUtxoPos);

        bool isSpent = condition.verify(
            data.args.inputTx,
            inputUtxoPos.outputIndex(),
            inputUtxoPos.txPos().value,
            data.args.challengingTx,
            data.args.challengingTxInputIndex,
            data.args.challengingTxWitness,
            data.args.spendingConditionOptionalArgs
        );
        require(isSpent, "Spending condition failed");
    }
}
