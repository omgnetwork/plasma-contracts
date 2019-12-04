pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../PaymentExitDataModel.sol";
import "../routers/PaymentStandardExitRouterArgs.sol";
import "../../interfaces/ISpendingCondition.sol";
import "../../interfaces/ITxFinalizationVerifier.sol";
import "../../models/TxFinalizationModel.sol";
import "../../registries/SpendingConditionRegistry.sol";
import "../../utils/OutputId.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../utils/IsDeposit.sol";
import "../../../utils/SafeEthTransfer.sol";
import "../../../utils/UtxoPosLib.sol";
import "../../../transactions/PaymentTransactionModel.sol";
import "../../../transactions/WireTransaction.sol";
import "../../../transactions/outputs/PaymentOutputModel.sol";

library PaymentChallengeStandardExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        ITxFinalizationVerifier txFinalizationVerifier;
        uint256 safeGasStipend;
    }

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    /**
     * @dev Data to be passed around helper functions
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
        ITxFinalizationVerifier txFinalizationVerifier,
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
            txFinalizationVerifier: txFinalizationVerifier,
            safeGasStipend: safeGasStipend
        });
    }

    /**
     * @notice Main logic function to challenge standard exit
     * @dev emits ExitChallenged event on success
     * @param self The controller struct
     * @param exitMap The storage of all standard exit data
     * @param args Arguments of challenge standard exit function from client
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

        exitMap.exits[args.exitId].exitable = false;

        SafeEthTransfer.transferRevertOnError(msg.sender, data.exitData.bondSize, self.safeGasStipend);

        emit ExitChallenged(data.exitData.utxoPos);
    }

    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "The exit does not exist");
    }

    function verifyChallengeTxProtocolFinalized(ChallengeStandardExitData memory data) private view {
        uint256 challengeTxType = WireTransaction.getTransactionType(data.args.challengeTx);
        uint8 protocol = data.controller.framework.protocols(challengeTxType);

        //TODO: simplify tx finalization to be MoreVP only
        TxFinalizationModel.Data memory finalizationData = TxFinalizationModel.Data({
            framework: data.controller.framework,
            protocol: protocol,
            txBytes: data.args.challengeTx,
            txPos: TxPosLib.TxPos(data.args.challengeTxPos),
            inclusionProof: data.args.challengeTxInclusionProof,
            confirmSig: bytes(""),
            confirmSigAddress: address(0)
        });
        require(data.controller.txFinalizationVerifier.isProtocolFinalized(finalizationData),
                "Challenge transaction is not protocol finalized");
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        PaymentOutputModel.Output memory output = PaymentTransactionModel
            .decode(args.exitingTx)
            .outputs[utxoPos.outputIndex()];

        uint256 challengeTxType = WireTransaction.getTransactionType(args.challengeTx);
        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            output.outputType, challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        bytes32 outputId = data.controller.isDeposit.test(utxoPos.blockNum())
                ? OutputId.computeDepositOutputId(args.exitingTx, utxoPos.outputIndex(), utxoPos.value)
                : OutputId.computeNormalOutputId(args.exitingTx, utxoPos.outputIndex());
        require(outputId == data.exitData.outputId, "Invalid exiting tx causing outputId mismatch");
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
