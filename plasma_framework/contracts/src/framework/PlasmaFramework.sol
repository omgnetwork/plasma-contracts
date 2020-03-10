pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./BlockController.sol";
import "./ExitGameController.sol";
import "./registries/VaultRegistry.sol";
import "./registries/ExitGameRegistry.sol";

contract PlasmaFramework is VaultRegistry, ExitGameRegistry, ExitGameController, BlockController {
    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;

    /**
     * The minimum finalization period is the Plasma guarantee that all exits are safe provided the user takes action within the specified time period
     * When the child chain is rogue, user should start their exit and challenge any invalid exit within this period
     * An exit can be processed/finalized after minimum two finalization periods from its inclusion position, unless it is an exit for a deposit,
     * which would use one finalization period, instead of two
     *
     * For the Abstract Layer Design, OmiseGO also uses some multitude of this period to update its framework
     * See also ExitGameRegistry.sol, VaultRegistry.sol, and Vault.sol for more information on the update waiting time (the quarantined period)
     *
     * MVP: https://ethresear.ch/t/minimal-viable-plasma/426
     * MoreVP: https://github.com/omisego/elixir-omg/blob/master/docs/morevp.md#timeline
     * Special period for deposit: https://git.io/JecCV
     */
    uint256 public minExitPeriod;
    address private maintainer;
    string public version;

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

    /**
     * @notice Gets the semantic version of the current deployed contracts
    */
    function getVersion() external view returns (string memory) {
        return version;
    }
    
    /**
     * @notice Sets the semantic version of the current deployed contracts
     * @param _version is semver string
     */
    function setVersion(string memory _version) public onlyFrom(getMaintainer()) {
        version = _version;
    }
}