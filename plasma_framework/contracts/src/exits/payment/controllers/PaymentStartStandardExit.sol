pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../utils/OutputId.sol";
import "../../utils/MoreVpFinalization.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../utils/PosLib.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../utils/ExitableTimestamp.sol";

library PaymentStartStandardExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using PosLib for PosLib.Position;
    using PaymentTransactionModel for PaymentTransactionModel.Transaction;

    struct Controller {
        IExitProcessor exitProcessor;
        PlasmaFramework framework;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
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
        PosLib.Position utxoPos;
        PaymentTransactionModel.Transaction outputTx;
        FungibleTokenOutputModel.Output output;
        uint168 exitId;
        bool isTxDeposit;
        uint256 txBlockTimeStamp;
        bytes32 outputId;
    }

    event ExitStarted(
        address indexed owner,
        uint168 exitId
    );

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentStartStandardExit
     */
    function buildController(
        IExitProcessor exitProcessor,
        PlasmaFramework framework,
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
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
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
        PosLib.Position memory utxoPos = PosLib.decode(args.utxoPos);
        PaymentTransactionModel.Transaction memory outputTx = PaymentTransactionModel.decode(args.rlpOutputTx);
        FungibleTokenOutputModel.Output memory output = outputTx.getOutput(utxoPos.outputIndex);
        bool isTxDeposit = controller.framework.isDeposit(utxoPos.blockNum);
        uint168 exitId = ExitId.getStandardExitId(isTxDeposit, args.rlpOutputTx, utxoPos);
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum);

        bytes32 outputId = isTxDeposit
            ? OutputId.computeDepositOutputId(args.rlpOutputTx, utxoPos.outputIndex, utxoPos.encode())
            : OutputId.computeNormalOutputId(args.rlpOutputTx, utxoPos.outputIndex);

        return StartStandardExitData({
            controller: controller,
            args: args,
            utxoPos: utxoPos,
            outputTx: outputTx,
            output: output,
            exitId: exitId,
            isTxDeposit: isTxDeposit,
            txBlockTimeStamp: blockTimestamp,
            outputId: outputId
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

        require(PaymentTransactionModel.getOutputOwner(data.output) == msg.sender, "Only output owner can start an exit");

        require(isStandardFinalized(data), "The transaction must be standard finalized");
        PaymentExitDataModel.StandardExit memory exit = exitMap.exits[data.exitId];
        require(exit.amount == 0, "Exit has already started");

        require(self.framework.isOutputFinalized(data.outputId) == false, "Output is already spent");
    }

    function isStandardFinalized(StartStandardExitData memory data)
        private
        view
        returns (bool)
    {
        return MoreVpFinalization.isStandardFinalized(
            data.controller.framework,
            data.args.rlpOutputTx,
            data.utxoPos.toStrictTxPos(),
            data.args.outputTxInclusionProof
        );
    }

    function saveStandardExitData(
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
    {
        exitMap.exits[data.exitId] = PaymentExitDataModel.StandardExit({
            exitable: true,
            utxoPos: data.utxoPos.encode(),
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
            vaultId, data.output.token, exitableAt, data.utxoPos.toStrictTxPos(),
            data.exitId, data.controller.exitProcessor
        );
    }
}
