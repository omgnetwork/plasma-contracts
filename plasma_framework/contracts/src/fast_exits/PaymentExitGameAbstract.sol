pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../exits/payment/PaymentExitGameArgs.sol";
import "../exits/payment/routers/PaymentStandardExitRouter.sol";
import "../exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../exits/utils/ExitId.sol";
import "../exits/registries/SpendingConditionRegistry.sol";
import "../framework/interfaces/IExitProcessor.sol";
import "../framework/PlasmaFramework.sol";
import "../utils/OnlyFromAddress.sol";

/**
 * @notice The exit game contract implementation for Payment Transaction
 */
contract PaymentExitGame is IExitProcessor, OnlyFromAddress, PaymentStandardExitRouter, PaymentInFlightExitRouter {
    PlasmaFramework private plasmaFramework;

    /**
     * @dev use struct PaymentExitGameArgs to avoid stack too deep compilation error.
     */
    constructor(PaymentExitGameArgs.Args memory args)
        public
        PaymentStandardExitRouter(args)
        PaymentInFlightExitRouter(args)
    {
    }

    /**
     * @notice Callback processes exit function for the PlasmaFramework to call
     * @param exitId The exit ID
     * @param token Token (ERC20 address or address(0) for ETH) of the exiting output
     */
    function processExit(uint160 exitId, uint256, address token) external onlyFrom(address(plasmaFramework)) {
    }

    /**
     * @notice Helper function to compute the standard exit ID
     */
    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint160)
    {
    }

    /**
     * @notice Helper function to compute the in-flight exit ID
     */
    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint160)
    {
    }
}
