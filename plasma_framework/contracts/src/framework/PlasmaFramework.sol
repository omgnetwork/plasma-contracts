pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./BlockController.sol";
import "./ExitGameController.sol";
import "./registries/VaultRegistry.sol";
import "./registries/ExitGameRegistry.sol";

contract PlasmaFramework is VaultRegistry, ExitGameRegistry, ExitGameController, BlockController {
    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;

    /**
     * The minimum finalization period. This is the Plasma promise that all exits would be safe if user take action within the period of this time.
     * When the child chain is rogue, user should start their exit within this period. Also, user should challenge any invalid exit within this period.
     * An exit can be processed/finalized after 2 mininum finlization period from its inclusion position unless it is a exit for deposit
     * which would be using 1 period instead of 2.
     *
     * For the Abstract Layer Design, we also uses some multitude of this period to make update to our framework.
     * See ExitGameRegistry.sol, VaultRegistry.sol and Vault.sol for more details on the update waiting time (quarantined period).
     *
     * MVP: https://ethresear.ch/t/minimal-viable-plasma/426
     * MoreVP: https://github.com/omisego/elixir-omg/blob/master/docs/morevp.md#timeline
     * Special period for deposit: https://git.io/JecCV
     */
    uint256 public minExitPeriod;
    address private maintainer;

    constructor(
        uint256 _minExitPeriod,
        uint256 _initialImmuneVaults,
        uint256 _initialImmuneExitGames,
        address _authority,
        address _maintainer
    )
        public
        BlockController(CHILD_BLOCK_INTERVAL, _minExitPeriod, _initialImmuneVaults, _authority)
        ExitGameController(_minExitPeriod, _initialImmuneExitGames)
    {
        minExitPeriod = _minExitPeriod;
        maintainer = _maintainer;
    }

    function getMaintainer() public view returns (address) {
        return maintainer;
    }
}
