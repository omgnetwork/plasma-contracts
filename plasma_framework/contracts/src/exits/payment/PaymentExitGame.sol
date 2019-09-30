pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./routers/PaymentStandardExitRouter.sol";
import "./routers/PaymentInFlightExitRouter.sol";
import "../interfaces/IStateTransitionVerifier.sol";
import "../interfaces/ITxFinalizationVerifier.sol";
import "../utils/ExitId.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../vaults/EthVault.sol";
import "../../vaults/Erc20Vault.sol";
import "../../utils/OnlyFromAddress.sol";

/**
 * @notice The exit game contract implementation for Payment Transaction
 */
contract PaymentExitGame is IExitProcessor, PaymentStandardExitRouter, PaymentInFlightExitRouter, OnlyFromAddress {

    PlasmaFramework private plasmaFramework;

    constructor(
        PlasmaFramework framework,
        EthVault ethVault,
        Erc20Vault erc20Vault,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier stateTransitionVerifier,
        ITxFinalizationVerifier txFinalizationVerifier,
        uint256 supportTxType
    )
        public
        PaymentStandardExitRouter(
            framework,
            ethVault,
            erc20Vault,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            txFinalizationVerifier
        )
        PaymentInFlightExitRouter(
            framework,
            ethVault,
            erc20Vault,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            stateTransitionVerifier,
            txFinalizationVerifier,
            supportTxType
        )
    {
        plasmaFramework = framework;
    }

    /**
     * @notice Callback processes exit function for the PlasmaFramework to call.
     * @param exitId The exit id.
     * @param token The token (ERC20 address or address(0) for ETH) of the exiting output.
     */
    function processExit(uint160 exitId, address token) external onlyFrom(address(plasmaFramework)) {
        if (ExitId.isStandardExit(exitId)) {
            PaymentStandardExitRouter.processStandardExit(exitId, token);
        } else {
            PaymentInFlightExitRouter.processInFlightExit(exitId, token);
        }
    }

    /**
     * @notice Helper function to compute standard exit id.
     */
    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint192)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    /**
     * @notice Helper function to compute in-flight exit id.
     */
    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint192)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}
