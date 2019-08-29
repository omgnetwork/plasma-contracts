pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartStandardExit.sol";
import "../controllers/PaymentProcessStandardExit.sol";
import "../controllers/PaymentChallengeStandardExit.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../registries/OutputGuardHandlerRegistry.sol";
import "../../utils/BondSize.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../framework/utils/Operated.sol";
import "../../../utils/OnlyWithValue.sol";

contract PaymentStandardExitRouter is
    IExitProcessor,
    Operated,
    OnlyWithValue
{
    using PaymentStartStandardExit for PaymentStartStandardExit.Controller;
    using PaymentChallengeStandardExit for PaymentChallengeStandardExit.Controller;
    using PaymentProcessStandardExit for PaymentProcessStandardExit.Controller;
    using BondSize for BondSize.Params;

    // Initial bond size = 70000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_BOND_SIZE = 14000000000000000 wei;

    PaymentExitDataModel.StandardExitMap standardExitMap;
    PaymentStartStandardExit.Controller startStandardExitController;
    PaymentProcessStandardExit.Controller processStandardExitController;
    PaymentChallengeStandardExit.Controller challengeStandardExitController;
    BondSize.Params bond;

    event StandardExitBondUpdated(uint128 bondSize);

    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardHandlerRegistry _outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry _spendingConditionRegistry
    )
        public
    {
        startStandardExitController = PaymentStartStandardExit.buildController(
            this, _framework, _outputGuardHandlerRegistry
        );

        challengeStandardExitController = PaymentChallengeStandardExit.Controller(
            _framework, _spendingConditionRegistry
        );

        processStandardExitController = PaymentProcessStandardExit.Controller(
            _framework, _ethVault, _erc20Vault
        );

        bond = BondSize.buildParams(INITIAL_BOND_SIZE);
    }

    function standardExits(uint192 _exitId) public view returns (PaymentExitDataModel.StandardExit memory) {
        return standardExitMap.exits[_exitId];
    }

    /**
     * @notice Gets the standard exit bond size.
     */
    function bondSize() public view returns (uint256) {
        return bond.bondSize();
    }

    /**
     * @notice Updates the standard exit bond size. Will take 2 days to come into effect.
     * @param newBondSize The new bond size.
     */
    function updateBondSize(uint128 newBondSize) public onlyOperator {
        bond.updateBondSize(newBondSize);
        emit StandardExitBondUpdated(newBondSize);
    }

    /**
     * @notice Starts a standard exit of a given output. Uses output-age priority.
     */
    function startStandardExit(
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
        payable
        onlyWithValue(bond.bondSize())
    {
        startStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Challenge a standard exit by showing the exiting output was spent.
     */
    function challengeStandardExit(PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args)
        public
        payable
    {
        challengeStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Process standard exit.
     * @dev This function is designed to be called in the main processExit function. Thus using internal.
     * @param _exitId The standard exit id.
     */
    function processStandardExit(uint192 _exitId) internal {
        processStandardExitController.run(standardExitMap, _exitId);
    }
}
