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
import "../../../utils/IsDeposit.sol";
import "../../../utils/Merkle.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/GenericTransaction.sol";

library PaymentChallengeIFEInputSpent {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        uint256 safeGasStipend;
    }

    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 indexed txHash,
        uint16 inputIndex
    );

    /**
     * @dev Data to be passed around helper functions
     */
    struct ChallengeIFEData {
        Controller controller;
        PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args;
        PaymentExitDataModel.InFlightExit ife;
    }

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentChallengeIFEInputSpent
     */
    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        uint256 safeGasStipend
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            spendingConditionRegistry: spendingConditionRegistry,
            safeGasStipend: safeGasStipend
        });
    }

    /**
     * @notice Main logic implementation for 'challengeInFlightExitInputSpent'
     * @dev emits InFlightExitInputBlocked event on success
     * @param self The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param args Arguments of 'challengeInFlightExitInputSpent' function from client
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs memory args
    )
        public
    {
        uint160 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];

        require(ife.exitStartTimestamp != 0, "In-flight exit does not exist");
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
        verifyChallengingTransactionProtocolFinalized(data);
        verifySpendingCondition(data);

        // Remove the input from the piggyback map
        ife.clearInputPiggybacked(args.inFlightTxInputIndex);

        uint256 piggybackBondSize = ife.inputs[args.inFlightTxInputIndex].piggybackBondSize;
        SafeEthTransfer.transferRevertOnError(msg.sender, piggybackBondSize, self.safeGasStipend);

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

    function verifyChallengingTransactionProtocolFinalized(ChallengeIFEData memory data)
        private
        view
    {
        bool isProtocolFinalized = MoreVpFinalization.isProtocolFinalized(
            data.controller.framework,
            data.args.challengingTx
        );

        // MoreVP protocol finalization would only return false only when tx does not exists.
        // Should fail already in early stages (eg. decode)
        assert(isProtocolFinalized);
    }

    function verifySpendingCondition(ChallengeIFEData memory data) private view {
        GenericTransaction.Transaction memory challengingTx = GenericTransaction.decode(data.args.challengingTx);
        GenericTransaction.Output memory output = GenericTransaction.getOutput(challengingTx, data.args.challengingTxInputIndex);

        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            output.outputType, challengingTx.txType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        UtxoPosLib.UtxoPos memory inputUtxoPos = UtxoPosLib.UtxoPos(data.args.inputUtxoPos);

        bool isSpent = condition.verify(
            data.args.inputTx,
            inputUtxoPos.outputIndex(),
            inputUtxoPos.txPos().value,
            data.args.challengingTx,
            data.args.challengingTxInputIndex,
            data.args.challengingTxWitness
        );
        require(isSpent, "Spending condition failed");
    }
}
