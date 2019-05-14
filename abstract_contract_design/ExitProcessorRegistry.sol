pragma solidity ^0.5.0;

contract ExitProcessorRegistry {
    /**
     * @dev Register an exit processor to the Plasma framework. This can be only called by contract admin. It is binded with tx type.
     * @param _txType tx type that uses the exit game.
     * @param _contractAddress Address of the app contract.
     * @param _version version of the contract.
     */
    function registerExitProcessor(uint256 _txType, address _contractAddress, uint256 _version) external;

    function getExitProcessorContractByVersion(uint256 _txType, uint256 _version) external;

    // use this function to upgrade, need to check the whether the version is registered > 2 weeks
    function upgradeExitProcessorContractTo(uint256 _txType, uint256 _version) external;

    // this returns the current version
    function getExitProcessorContract(uint256 _txType) public view returns (address);
}
