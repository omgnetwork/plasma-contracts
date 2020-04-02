pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentV2ExitGameArgs.sol";
import "./routers/PaymentV2StandardExitRouter.sol";
import "./routers/PaymentV2InFlightExitRouter.sol";
import "../utils/ExitId.sol";
import "../registries/SpendingConditionRegistry.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../utils/OnlyFromAddress.sol";

/**
 * @notice The exit game contract implementation for Payment Transaction
 */
contract PaymentV2ExitGame is IExitProcessor, OnlyFromAddress, PaymentV2StandardExitRouter, PaymentV2InFlightExitRouter {
    PlasmaFramework private plasmaFramework;

    /**
     * @dev use struct PaymentExitGameArgs to avoid stack too deep compilation error.
     */
    constructor(PaymentV2ExitGameArgs.Args memory args)
        public
        PaymentV2StandardExitRouter(args)
        PaymentV2InFlightExitRouter(args)
    {
        plasmaFramework = args.framework;

        // makes sure that the spending condition has already renounced ownership
        require(args.spendingConditionRegistry.owner() == address(0), "Spending condition registry ownership needs to be renounced");
    }

    /**
     * @notice Callback processes exit function for the PlasmaFramework to call
     * @param exitId The exit ID
     * @param token Token (ERC20 address or address(0) for ETH) of the exiting output
     */
    function processExit(uint160 exitId, uint256, address token) external onlyFrom(address(plasmaFramework)) {
        if (ExitId.isStandardExit(exitId)) {
            PaymentV2StandardExitRouter.processStandardExit(exitId, token);
        } else {
            PaymentV2InFlightExitRouter.processInFlightExit(exitId, token);
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
        PosLib.Position memory utxoPos = PosLib.decode(_utxoPos);
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
