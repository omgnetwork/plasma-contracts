pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../interfaces/IOutputGuardHandler.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../models/OutputGuardModel.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/OutputId.sol";
import "../../utils/TxFinalization.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../utils/IsDeposit.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/WireTransaction.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";

library PaymentChallengeStandardExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using TxFinalization for TxFinalization.Verifier;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
    }

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    /**
     * @dev data to be passed around helper functions
     */
    struct ChallengeStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args;
        PaymentExitDataModel.StandardExit exitData;
    }

    /**
     * @notice Function that builds the controller struct
     * @return Controller struct of PaymentChallengeStandardExit
     */
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

    /**
     * @notice Main logic function to challenge standard exit
     * @dev emits ExitChallenged event if suceed
     * @param self the controller struct
     * @param exitMap the storage of all standard exit data
     * @param args arguments of challenge standard exit function from client.
     */
    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args
    )
        public
    {
        ChallengeStandardExitData memory data = ChallengeStandardExitData({
            controller: self,
            args: args,
            exitData: exitMap.exits[args.exitId]
        });
        verifyChallengeExitExists(data);
        verifyChallengeTxProtocolFinalized(data);
        verifySpendingCondition(data);

        delete exitMap.exits[args.exitId];
        msg.sender.transfer(data.exitData.bondSize);

        emit ExitChallenged(data.exitData.utxoPos);
    }

    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "Such exit does not exist");
    }

    function verifyChallengeTxProtocolFinalized(ChallengeStandardExitData memory data) private view {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        PaymentOutputModel.Output memory output = PaymentTransactionModel
            .decode(data.args.exitingTx)
            .outputs[utxoPos.outputIndex()];

        IOutputGuardHandler outputGuardHandler = data.controller
                                                .outputGuardHandlerRegistry
                                                .outputGuardHandlers(data.args.outputType);

        require(address(outputGuardHandler) != address(0), "Failed to get the outputGuardHandler of the output type");

        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: data.args.outputType,
            preimage: data.args.outputGuardPreimage
        });
        require(outputGuardHandler.isValid(outputGuardData),
                "Output guard information is invalid");

        uint256 challengeTxType = WireTransaction.getTransactionType(data.args.challengeTx);
        uint8 protocol = data.controller.framework.protocols(challengeTxType);
        TxFinalization.Verifier memory verifier = TxFinalization.Verifier({
            framework: data.controller.framework,
            protocol: protocol,
            txBytes: data.args.challengeTx,
            txPos: TxPosLib.TxPos(data.args.challengeTxPos),
            inclusionProof: data.args.challengeTxInclusionProof,
            confirmSig: data.args.challengeTxConfirmSig,
            confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
        });
        require(verifier.isProtocolFinalized(), "Challenge transaction is not protocol finalized");
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;

        // correctness of output type is checked in the outputGuardHandler.isValid(...)
        // inside verifyChallengeTxProtocolFinalized(...)
        uint256 challengeTxType = WireTransaction.getTransactionType(data.args.challengeTx);
        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            args.outputType, challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        bytes32 outputId = data.controller.isDeposit.test(utxoPos.blockNum())
                ? OutputId.computeDepositOutputId(args.exitingTx, utxoPos.outputIndex(), utxoPos.value)
                : OutputId.computeNormalOutputId(args.exitingTx, utxoPos.outputIndex());
        require(outputId == data.exitData.outputId, "The exiting tx is not valid, thus causing outputId mismatch");
        bool isSpentByChallengeTx = condition.verify(
            args.exitingTx,
            utxoPos.outputIndex(),
            utxoPos.txPos().value,
            args.challengeTx,
            args.inputIndex,
            args.witness,
            args.spendingConditionOptionalArgs
        );
        require(isSpentByChallengeTx, "Spending condition failed");
    }
}
