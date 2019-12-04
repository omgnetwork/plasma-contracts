pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../models/TxFinalizationModel.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../utils/ExitableTimestamp.sol";

library PaymentStartStandardExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    struct Controller {
        IExitProcessor exitProcessor;
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
        ITxFinalizationVerifier txFinalizationVerifier;
        uint256 ethVaultId;
        uint256 erc20VaultId;
        uint256 supportedTxType;
    }

    /**
     * @dev Data to be passed around startStandardExit helper functions
     */
    struct StartStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.StartStandardExitArgs args;
        UtxoPosLib.UtxoPos utxoPos;
        PaymentTransactionModel.Transaction outputTx;
        PaymentOutputModel.Output output;
        uint160 exitId;
        bool isTxDeposit;
        uint256 txBlockTimeStamp;
        bytes32 outputId;
        TxFinalizationModel.Data finalizationData;
    }

    event ExitStarted(
        address indexed owner,
        uint160 exitId
    );

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentStartStandardExit
     */
    function buildController(
        IExitProcessor exitProcessor,
        PlasmaFramework framework,
        ITxFinalizationVerifier txFinalizationVerifier,
        uint256 ethVaultId,
        uint256 erc20VaultId,
        uint256 supportedTxType
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            exitProcessor: exitProcessor,
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            txFinalizationVerifier: txFinalizationVerifier,
            ethVaultId: ethVaultId,
            erc20VaultId: erc20VaultId,
            supportedTxType: supportedTxType
        });
    }

    /**
     * @notice Main logic function to start standard exit
     * @dev emits ExitStarted event on success
     * @param self The controller struct
     * @param exitMap The storage of all standard exit data
     * @param args Arguments of start standard exit function from client
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
    {
        StartStandardExitData memory data = setupStartStandardExitData(self, args);
        verifyStartStandardExitData(self, data, exitMap);
        saveStandardExitData(data, exitMap);
        enqueueStandardExit(data);

        emit ExitStarted(msg.sender, data.exitId);
    }

    function setupStartStandardExitData(
        Controller memory controller,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        private
        view
        returns (StartStandardExitData memory)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.utxoPos);
        PaymentTransactionModel.Transaction memory outputTx = PaymentTransactionModel.decode(args.rlpOutputTx);
        PaymentOutputModel.Output memory output = outputTx.outputs[utxoPos.outputIndex()];
        bool isTxDeposit = controller.isDeposit.test(utxoPos.blockNum());
        uint160 exitId = ExitId.getStandardExitId(isTxDeposit, args.rlpOutputTx, utxoPos);
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());

        TxFinalizationModel.Data memory finalizationData = TxFinalizationModel.moreVpData(
            controller.framework,
            args.rlpOutputTx,
            utxoPos.txPos(),
            args.outputTxInclusionProof
        );

        bytes32 outputId = isTxDeposit
            ? OutputId.computeDepositOutputId(args.rlpOutputTx, utxoPos.outputIndex(), utxoPos.value)
            : OutputId.computeNormalOutputId(args.rlpOutputTx, utxoPos.outputIndex());

        return StartStandardExitData({
            controller: controller,
            args: args,
            utxoPos: utxoPos,
            outputTx: outputTx,
            output: output,
            exitId: exitId,
            isTxDeposit: isTxDeposit,
            txBlockTimeStamp: blockTimestamp,
            outputId: outputId,
            finalizationData: finalizationData
        });
    }

    function verifyStartStandardExitData(
        Controller memory self,
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
        view
    {
        require(data.outputTx.txType == data.controller.supportedTxType, "Unsupported transaction type of the exit game");
        require(data.txBlockTimeStamp != 0, "There is no block for the position");

        require(data.output.owner() == msg.sender, "Only output owner can start an exit");

        require(data.controller.txFinalizationVerifier.isStandardFinalized(data.finalizationData), "The transaction must be standard finalized");
        PaymentExitDataModel.StandardExit memory exit = exitMap.exits[data.exitId];
        require(exit.amount == 0, "Exit has already started");

        require(self.framework.isOutputSpent(data.outputId) == false, "Output is already spent");
    }

    function saveStandardExitData(
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
    {
        exitMap.exits[data.exitId] = PaymentExitDataModel.StandardExit({
            exitable: true,
            utxoPos: data.utxoPos.value,
            outputId: data.outputId,
            exitTarget: msg.sender,
            amount: data.output.amount,
            bondSize: msg.value
        });
    }

    function enqueueStandardExit(StartStandardExitData memory data) private {

        uint64 exitableAt;
        ExitableTimestamp.Calculator memory exitableTimestampCalculator = data.controller.exitableTimestampCalculator;

        if (data.isTxDeposit){
            exitableAt = exitableTimestampCalculator.calculateDepositTxOutputExitableTimestamp(block.timestamp);
        } else {
            exitableAt = exitableTimestampCalculator.calculateTxExitableTimestamp(block.timestamp, data.txBlockTimeStamp);
        }

        uint256 vaultId;
        if (data.output.token == address(0)) {
            vaultId = data.controller.ethVaultId;
        } else {
            vaultId = data.controller.erc20VaultId;
        }

        data.controller.framework.enqueue(
            vaultId, data.output.token, exitableAt, data.utxoPos.txPos(),
            data.exitId, data.controller.exitProcessor
        );
    }
}
