pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../PaymentInFlightExitModelUtils.sol";
import "../routers/PaymentInFlightExitRouterArgs.sol";
import "../../utils/ExitableTimestamp.sol";
import "../../utils/ExitId.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/UtxoPosLib.sol";

library PaymentPiggybackInFlightExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
        IExitProcessor exitProcessor;
        uint256 minExitPeriod;
        uint256 ethVaultId;
        uint256 erc20VaultId;
    }

    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 indexed txHash,
        uint16 inputIndex
    );

    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 indexed txHash,
        uint16 outputIndex
    );

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentPiggybackInFlightExit
     */
    function buildController(
        PlasmaFramework framework,
        IExitProcessor exitProcessor,
        uint256 ethVaultId,
        uint256 erc20VaultId
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            exitProcessor: exitProcessor,
            minExitPeriod: framework.minExitPeriod(),
            ethVaultId: ethVaultId,
            erc20VaultId: erc20VaultId
        });
    }

    /**
     * @notice The main controller logic for 'piggybackInFlightExitOnInput'
     * @dev emits InFlightExitInputPiggybacked event on success
     * @param self The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param args Arguments of 'piggybackInFlightExitOnInput' function from client
     */
    function piggybackInput(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs memory args
    )
        public
    {
        uint160 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];

        require(exit.exitStartTimestamp != 0, "No in-flight exit to piggyback on");
        require(exit.isInFirstPhase(self.minExitPeriod), "Piggyback is possible only in the first phase of the exit period");

        require(!exit.isInputEmpty(args.inputIndex), "Indexed input is empty");
        require(!exit.isInputPiggybacked(args.inputIndex), "Indexed input already piggybacked");

        PaymentExitDataModel.WithdrawData storage withdrawData = exit.inputs[args.inputIndex];

        // In startInFlightExit, exitTarget for inputs are saved as this data is required to create the transaction
        require(withdrawData.exitTarget == msg.sender, "Can be called only by the exit target");
        withdrawData.piggybackBondSize = msg.value;

        if (isFirstPiggybackOfTheToken(exit, withdrawData.token)) {
            enqueue(self, withdrawData.token, UtxoPosLib.UtxoPos(exit.position), exitId);
        }

        exit.setInputPiggybacked(args.inputIndex);

        emit InFlightExitInputPiggybacked(msg.sender, keccak256(args.inFlightTx), args.inputIndex);
    }

    /**
     * @notice The main controller logic for 'piggybackInFlightExitOnOutput'
     * @dev emits InFlightExitOutputPiggybacked event on success
     * @param self The controller struct
     * @param inFlightExitMap The storage of all in-flight exit data
     * @param args Arguments of 'piggybackInFlightExitOnOutput' function from client
     */
    function piggybackOutput(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs memory args
    )
        public
    {
        uint160 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];

        require(exit.exitStartTimestamp != 0, "No in-flight exit to piggyback on");
        require(exit.isInFirstPhase(self.minExitPeriod), "Piggyback is possible only in the first phase of the exit period");

        require(!exit.isOutputEmpty(args.outputIndex), "Indexed output is empty");
        require(!exit.isOutputPiggybacked(args.outputIndex), "Indexed output already piggybacked");

        PaymentExitDataModel.WithdrawData storage withdrawData = exit.outputs[args.outputIndex];

        // TODO: move this to start IFE, as we are removing the mechanism of using output guard preimage.
        // For inputs, exit target is set during start inFlight exit.
        // For outputs, since output preimage data is held by the output owners, these must be retrieved on piggyback.
        FungibleTokenOutputModel.Output memory output = PaymentTransactionModel.decode(args.inFlightTx).outputs[args.outputIndex];
        address payable exitTarget = PaymentTransactionModel.getOutputOwner(output);
        require(exitTarget == msg.sender, "Can be called only by the exit target");

        if (isFirstPiggybackOfTheToken(exit, withdrawData.token)) {
            enqueue(self, withdrawData.token, UtxoPosLib.UtxoPos(exit.position), exitId);
        }

        // Exit target for outputs is set in piggyback instead of start in-flight exit
        withdrawData.exitTarget = exitTarget;
        withdrawData.piggybackBondSize = msg.value;

        exit.setOutputPiggybacked(args.outputIndex);

        emit InFlightExitOutputPiggybacked(msg.sender, keccak256(args.inFlightTx), args.outputIndex);
    }

    function enqueue(
        Controller memory controller,
        address token,
        UtxoPosLib.UtxoPos memory utxoPos,
        uint160 exitId
    )
        private
    {
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());
        require(blockTimestamp != 0, "There is no block for the exit position to enqueue");

        uint64 exitableAt = controller.exitableTimestampCalculator.calculateTxExitableTimestamp(now, blockTimestamp);

        uint256 vaultId;
        if (token == address(0)) {
            vaultId = controller.ethVaultId;
        } else {
            vaultId = controller.erc20VaultId;
        }

        controller.framework.enqueue(vaultId, token, exitableAt, utxoPos.txPos(), exitId, controller.exitProcessor);
    }

    function isFirstPiggybackOfTheToken(ExitModel.InFlightExit memory ife, address token)
        private
        pure
        returns (bool)
    {
        for (uint i = 0; i < PaymentTransactionModel.MAX_INPUT_NUM(); i++) {
            if (ife.isInputPiggybacked(uint16(i)) && ife.inputs[i].token == token) {
                return false;
            }
        }

        for (uint i = 0; i < PaymentTransactionModel.MAX_OUTPUT_NUM(); i++) {
            if (ife.isOutputPiggybacked(uint16(i)) && ife.outputs[i].token == token) {
                return false;
            }
        }

        return true;
    }
}
