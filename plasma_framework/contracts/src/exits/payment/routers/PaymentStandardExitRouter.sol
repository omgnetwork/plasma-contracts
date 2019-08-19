pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./PaymentStandardExitRouterArgs.sol";
import "../PaymentExitDataModel.sol";
import "../controllers/PaymentStartStandardExitController.sol";
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
    using PaymentStartStandardExitController for PaymentStartStandardExitController.Object;

    uint256 public constant STANDARD_EXIT_BOND = 31415926535 wei;

    PaymentExitDataModel.StandardExitMap standardExitMap;
    PaymentStartStandardExitController.Object startStandardExitController;

    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardParserRegistry _outputGuardParserRegistry,
        PaymentSpendingConditionRegistry _spendingConditionRegistry
    )
        public
    {
        startStandardExitController = PaymentStartStandardExitController.init(
            this, _framework, _outputGuardParserRegistry
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
     * @dev Uses struct as input because too many variables and failed to compile.
     * @dev Uses public instead of external because ABIEncoder V2 does not support struct calldata + external
     * @param _args input argument data to challenge. See struct 'ChallengeStandardExitArgs' for detailed param info.
     */
    // function challengeStandardExit(ChallengeStandardExitArgs memory _args)
    //     public
    //     payable
    // {
    // }

    /**
     * @notice Process standard exit.
     * @dev This function is designed to be called in the main processExit function. Thus using internal.
     * @param _exitId The standard exit id.
     */
    function processStandardExit(uint192 _exitId) internal {
    }
}
