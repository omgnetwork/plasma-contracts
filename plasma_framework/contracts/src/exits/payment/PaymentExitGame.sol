pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./routers/PaymentStandardExitRouter.sol";
import "./routers/PaymentInFlightExitRouter.sol";
import "../interfaces/IStateTransitionVerifier.sol";
import "../interfaces/ITxFinalizationVerifier.sol";
import "../utils/ExitId.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../utils/OnlyFromAddress.sol";

/**
 * @notice The exit game contract implementation for Payment Transaction
 */
contract PaymentExitGame is IExitProcessor, OnlyFromAddress, PaymentStandardExitRouter, PaymentInFlightExitRouter {
    PlasmaFramework private plasmaFramework;

    /**
     * @param framework The Plasma framework
     * @param ethVaultId Vault id for EthVault
     * @param erc20VaultId Vault id for the Erc20Vault
     * @param outputGuardHandlerRegistry the outputGuardHandlerRegistry that can provide outputGuardHandler implementation by types
     * @param spendingConditionRegistry the spendingConditionRegistry that can provide spending condition implementation by types
     * @param stateTransitionVerifier state transition verifier predicate contract that checks the transaction correctness
     * @param txFinalizationVerifier util contract that checks tx is finalized or not
     * @param supportTxType the tx type of this exit game is using
     */
    struct PaymentExitGameArgs {
        PlasmaFramework framework;
        uint256 ethVaultId;
        uint256 erc20VaultId;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        SpendingConditionRegistry spendingConditionRegistry;
        IStateTransitionVerifier stateTransitionVerifier;
        ITxFinalizationVerifier txFinalizationVerifier;
        uint256 supportTxType;
        uint256 safeGasStipend;
    }

    /**
     * @dev use struct PaymentExitGameArgs to avoid stack too deep compilation error.
     */
    constructor(
        PaymentExitGameArgs memory args
    )
        public
        PaymentStandardExitRouter(
            args.framework,
            args.ethVaultId,
            args.erc20VaultId,
            args.outputGuardHandlerRegistry,
            args.spendingConditionRegistry,
            args.txFinalizationVerifier,
            args.safeGasStipend
        )
        PaymentInFlightExitRouter(
            args.framework,
            args.ethVaultId,
            args.erc20VaultId,
            args.outputGuardHandlerRegistry,
            args.spendingConditionRegistry,
            args.stateTransitionVerifier,
            args.txFinalizationVerifier,
            args.supportTxType,
            args.safeGasStipend
        )
    {
        plasmaFramework = args.framework;
    }

    /**
     * @notice Callback processes exit function for the PlasmaFramework to call
     * @param exitId The exit ID
     * @param token Token (ERC20 address or address(0) for ETH) of the exiting output
     */
    function processExit(uint160 exitId, uint256, address token) external onlyFrom(address(plasmaFramework)) {
        if (ExitId.isStandardExit(exitId)) {
            PaymentStandardExitRouter.processStandardExit(exitId, token);
        } else {
            PaymentInFlightExitRouter.processInFlightExit(exitId, token);
        }
    }

    /**
     * @notice Helper function to compute the standard exit ID
     */
    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint160)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    /**
     * @notice Helper function to compute the in-flight exit ID
     */
    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint160)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}
