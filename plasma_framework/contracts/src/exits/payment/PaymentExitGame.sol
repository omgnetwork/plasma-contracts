pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./PaymentExitGameArgs.sol";
import "./routers/PaymentStandardExitRouter.sol";
import "./routers/PaymentInFlightExitRouter.sol";
import "../utils/ExitId.sol";
import "../registries/SpendingConditionRegistry.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../utils/OnlyFromAddress.sol";

/**
 * @notice The exit game contract implementation for Payment Transaction
 */
contract PaymentExitGame is IExitProcessor, OnlyFromAddress, PaymentStandardExitRouter, PaymentInFlightExitRouter {
    PaymentExitGameArgs.Args private paymentExitGameArgs;
    bool private initDone = false;

    /**
     * @dev use struct PaymentExitGameArgs to avoid stack too deep compilation error.
     */
    constructor(PaymentExitGameArgs.Args memory args)
        public
        PaymentStandardExitRouter()
        PaymentInFlightExitRouter()
    {
        paymentExitGameArgs = args;
        // makes sure that the spending condition has already renounced ownership
        require(args.spendingConditionRegistry.owner() == address(0), "Spending condition registry ownership needs to be renounced");
    }

    function init() public onlyFrom(paymentExitGameArgs.framework.getMaintainer()) {
        require(!initDone, "Exit game was already initialized");
        initDone = true;
        PaymentStandardExitRouter.boot(paymentExitGameArgs);
        PaymentInFlightExitRouter.boot(paymentExitGameArgs); 
    }

    /**
     * @notice Callback processes exit function for the PlasmaFramework to call
     * @param exitId The exit ID
     * @param token Token (ERC20 address or address(0) for ETH) of the exiting output
     * @param processExitInitiator The processExits() initiator
     */
    function processExit(uint168 exitId, uint256, address token, address payable processExitInitiator) external onlyFrom(address(paymentExitGameArgs.framework)) {
        if (ExitId.isStandardExit(exitId)) {
            PaymentStandardExitRouter.processStandardExit(exitId, token, processExitInitiator);
        } else {
            PaymentInFlightExitRouter.processInFlightExit(exitId, token, processExitInitiator);
        }
    }

    /**
     * @notice Helper function to compute the standard exit ID
     */
    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint168)
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
        returns (uint168)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}
