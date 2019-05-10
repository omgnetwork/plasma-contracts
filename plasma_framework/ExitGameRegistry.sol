pragma solidity ^0.4.0;

import "./ExitGame.sol";
import "./Operated.sol";

contract ExitGameRegistry is Operated {

    /*
     * Storage
     */
    mapping (uint256 => ExitGame) public exitGames;

    /*
     * Events
     */

    event ExitGameRegistered (
        uint256 txType,
        address contractAddress
    );


    /*
     * API
     */


    /**
     * @dev Register an app to the MoreVp Plasma framework. This can be only called by contract admin.
     * @param _txType tx type that uses the exit game.
     * @param _contractAddress Address of the app contract.
     * @param _version version of the contract - In a PoC it is omitted
     */
    function registerExitGame(uint128 _txType, uint128 _version, address _contractAddress)
        external
        onlyOperator
    {

        // NOTE: tx type and version are 128-bit, so they can be concatenated into uint256
        require(exitGames[_txType] == address(0));

        exitGames[_txType] = ExitGame(_contractAddress);

        emit ExitGameRegistered(_txType, _contractAddress);
    }

    // TODO: out of PoC scope
    // function getExitGameContractByVersion(uint256 _txType, uint256 _version) external;

    // use this function to upgrade, need to check the whether the version is registered > 2 weeks
    // function upgradeExitGameContractTo(uint256 _txType, uint256 _version) external;

    // this returns the current version
    // NOTE (PoC): for not simply query exitGames storage
    // function getExitGameContract(uint256 _txType) public view returns (ExitGame) {
    // }

}