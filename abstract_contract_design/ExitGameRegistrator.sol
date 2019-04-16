pragma solidity ^0.5.0;

contract ExitGameRegistrator {
    mapping (bytes32 => address) private games;

    /**
     * @dev Register an app to the MoreVp Plasma framework. This can be only called by contract admin.
     * @param _contractAddress Address of the app contract.
     * @param _exitGame name of the exit game
     */
    function registerExitGame(address _contractAddress, bytes32 _version, bytes32 _exitGame) external;

    function getExitGameContractByVersion(bytes32 _exitGame, bytes32 _version) external;

    // use this function to upgrade, need to check the whether the version is registered > 2 weeks
    function upgradeExitGameContractTo(bytes32 _exitGame, bytes32 _version) external;

    // this returns the current version
    function getExitGameContract(bytes32 _exitGame) public view returns (address);
}
