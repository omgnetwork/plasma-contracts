pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartStandardExit.sol";
import "../controllers/PaymentProcessStandardExit.sol";
import "../controllers/PaymentChallengeStandardExit.sol";
import "../spendingConditions/PaymentSpendingConditionRegistry.sol";
import "../../OutputGuardParserRegistry.sol";
import "../../../vaults/EthVault.sol";
import "../../../vaults/Erc20Vault.sol";
import "../../../framework/PlasmaFramework.sol";
import "../../../framework/interfaces/IExitProcessor.sol";
import "../../../utils/OnlyWithValue.sol";

contract PaymentStandardExitRouter is
    IExitProcessor,
    OnlyWithValue,
    OutputGuardParserRegistry,
    PaymentSpendingConditionRegistry
{
    using PaymentStartStandardExit for PaymentStartStandardExit.Controller;
    using PaymentChallengeStandardExit for PaymentChallengeStandardExit.Controller;
    using PaymentProcessStandardExit for PaymentProcessStandardExit.Controller;

    uint256 public constant STANDARD_EXIT_BOND = 31415926535 wei;

    PaymentExitDataModel.StandardExitMap standardExitMap;
    PaymentStartStandardExit.Controller startStandardExitController;
    PaymentProcessStandardExit.Controller processStandardExitController;
    PaymentChallengeStandardExit.Controller challengeStandardExitController;

    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardParserRegistry _outputGuardParserRegistry,
        PaymentSpendingConditionRegistry _spendingConditionRegistry
    )
        public
    {
        startStandardExitController = PaymentStartStandardExit.buildController(
            this, _framework, _outputGuardParserRegistry
        );

        challengeStandardExitController = PaymentChallengeStandardExit.Controller(
            _framework, _spendingConditionRegistry, STANDARD_EXIT_BOND
        );

        processStandardExitController = PaymentProcessStandardExit.Controller(
            _framework, _ethVault, _erc20Vault, STANDARD_EXIT_BOND
        );
    }

    function standardExits(uint192 _exitId) public view returns (PaymentExitDataModel.StandardExit memory) {
        return standardExitMap.exits[_exitId];
    }

    /**
     * @notice Starts a standard exit of a given output. Uses output-age priority.
     */
    function startStandardExit(
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
        payable
        onlyWithValue(STANDARD_EXIT_BOND)
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
