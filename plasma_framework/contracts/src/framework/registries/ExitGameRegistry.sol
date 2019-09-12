pragma solidity ^0.5.0;

import "../Protocol.sol";
import "../utils/Operated.sol";
import "../utils/Quarantine.sol";

contract ExitGameRegistry is Operated {
    using Quarantine for Quarantine.Data;

    mapping(uint256 => address) public exitGames;
    mapping(address => uint256) public exitGameToTxType;
    mapping(uint256 => uint8) public protocols;
    Quarantine.Data public quarantine;

    event ExitGameRegistered(
        uint256 txType,
        address exitGameAddress,
        uint8 protocol
    );

    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
    {
        quarantine.quarantinePeriod = 3 * _minExitPeriod;
        quarantine.immunitiesRemaining = _initialImmuneExitGames;
    }

    modifier onlyFromNonQuarantinedExitGame() {
        require(exitGameToTxType[msg.sender] != 0, "Not being called by registered exit game contract");
        require(!quarantine.isQuarantined(msg.sender), "ExitGame is quarantined.");
        _;
    }

    /**
     * @dev Exposes information about exit games quarantine
     * @param _contract address of exit game contract
     * @return A boolean value denoting whether contract is safe to use, is not under quarantine
     */
    function isExitGameSafeToUse(address _contract) public view returns (bool) {
        return exitGameToTxType[_contract] != 0 && !quarantine.isQuarantined(_contract);
    }

    /**
     * @notice Register the exit game to Plasma framework. This can be only called by contract admin.
     * @param _txType tx type that the exit game want to register to.
     * @param _contract Address of the exit game contract.
     * @param _protocol The protocol of the transaction, 1 for MVP and 2 for MoreVP.
     */
    function registerExitGame(uint256 _txType, address _contract, uint8 _protocol) public onlyOperator {
        require(_txType != 0, "should not register with tx type 0");
        require(_contract != address(0), "should not register with an empty exit game address");
        require(Protocol.isValidProtocol(_protocol), "Invalid protocol value");

        require(exitGames[_txType] == address(0), "The tx type is already registered");
        require(exitGameToTxType[_contract] == 0, "The exit game contract is already registered");

        exitGames[_txType] = _contract;
        exitGameToTxType[_contract] = _txType;
        protocols[_txType] = _protocol;
        quarantine.quarantine(_contract);

        emit ExitGameRegistered(_txType, _contract, _protocol);
    }

}
