pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./routers/PaymentStandardExitRouter.sol";
import "../utils/ExitId.sol";
import "../../framework/interfaces/IExitProcessor.sol";
import "../../framework/PlasmaFramework.sol";
import "../../vaults/EthVault.sol";
import "../../vaults/Erc20Vault.sol";

contract PaymentExitGame is IExitProcessor, PaymentStandardExitRouter {
    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardHandlerRegistry _outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry _spendingConditionRegistry
    )
        public
        PaymentStandardExitRouter(_framework, _ethVault, _erc20Vault, _outputGuardHandlerRegistry, _spendingConditionRegistry) {
    }

    /**
     * @dev for ERC20, thus each erc contract address represent a token value
     * @dev for ETH, using address(0) as a preserved address of ERC contract
     */
    function processExit(uint192 exitId, address ercContract) external {
        address token = ercContract;
        if (ExitId.isStandardExit(exitId)) {
            PaymentStandardExitRouter.processStandardExit(exitId, token);
        } else {
            require(false, "TODO: implement process in flight exit");
        }
    }

    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint192)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint192)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}
