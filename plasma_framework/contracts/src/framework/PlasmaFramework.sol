pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./BlockController.sol";
import "./ExitGameController.sol";
import "./registries/VaultRegistry.sol";
import "./registries/ExitGameRegistry.sol";
import "./utils/Operated.sol";

contract PlasmaFramework is ExitGameController, BlockController {
    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;

    // NOTE: this is the "middle" period.
    // Exit period for fresh utxos is double of that while IFE phase is half of that
    uint256 public minExitPeriod;

    constructor(
        address operator,
        uint256 _minExitPeriod,
        uint256 _initialImmuneVaults,
        uint256 _initialImmuneExitGames
    )
        public
        BlockController(operator, CHILD_BLOCK_INTERVAL, _minExitPeriod, _initialImmuneVaults)
        ExitGameController(operator, _minExitPeriod, _initialImmuneExitGames)
    {
        minExitPeriod = _minExitPeriod;
    }
}
