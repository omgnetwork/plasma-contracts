pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./BlockController.sol";
import "./ExitGameController.sol";
import "./registries/VaultRegistry.sol";
import "./utils/Operated.sol";
import "./interfaces/IPlasmaFramework.sol";

contract PlasmaFramework is IPlasmaFramework, Operated, VaultRegistry, ExitGameController, BlockController {
    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;

    // NOTE: this is the "middle" period.
    // Exit period for fresh utxos is double of that while IFE phase is half of that
    uint256 public minExitPeriod;

    constructor(uint256 _minExitPeriod) public BlockController(CHILD_BLOCK_INTERVAL) {
        minExitPeriod = _minExitPeriod;
    }
}
