pragma solidity ^0.4.0;

contract ExitGameRegistry {
    /**
     * @dev Register an app to the MoreVp Plasma framework. This can be only called by contract admin.
     * @param _txType tx type that uses the exit game.
     * @param _contractAddress Address of the app contract.
     * @param _version version of the contract.
     */
    function registerExitGame(uint256 _txType, address _contractAddress, uint256 _version) external;

    function getExitGameContractByVersion(uint256 _txType, uint256 _version) external;

    // use this function to upgrade, need to check the whether the version is registered > 2 weeks
    function upgradeExitGameContractTo(uint256 _txType, uint256 _version) external;

    // this returns the current version
    function getExitGameContract(uint256 _txType) public view returns (address);
}