pragma solidity 0.5.11;

import "../Protocol.sol";
import "../utils/Quarantine.sol";
import "../../utils/OnlyFromAddress.sol";

contract ExitGameRegistry is OnlyFromAddress {
    using Quarantine for Quarantine.Data;

    mapping(uint256 => address) private _exitGames; // txType => exit game contract address
    mapping(address => uint256) private _exitGameToTxType; // exit game contract address => tx type
    mapping(uint256 => uint8) private _protocols; // tx type => protocol (MVP/MORE_VP)
    Quarantine.Data private _exitGameQuarantine;

    event ExitGameRegistered(
        uint256 txType,
        address exitGameAddress,
        uint8 protocol
    );

    /**
     * @dev It takes at least 3 * minExitPeriod before each new exit game contract is able to start protecting existing transactions
     *      see: https://github.com/omisego/plasma-contracts/issues/172
     *           https://github.com/omisego/plasma-contracts/issues/197
     */
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
    {
        _exitGameQuarantine.quarantinePeriod = 3 * _minExitPeriod;
        _exitGameQuarantine.immunitiesRemaining = _initialImmuneExitGames;
    }

    /**
     * @notice A modifier to verify that the call is from a non-quarantined exit game
     */
    modifier onlyFromNonQuarantinedExitGame() {
        require(_exitGameToTxType[msg.sender] != 0, "The call is not from a registered exit game contract");
        require(!_exitGameQuarantine.isQuarantined(msg.sender), "ExitGame is quarantined");
        _;
    }

    /**
     * @notice interface to get the 'maintainer' address.
     * @dev see discussion here: https://git.io/Je8is
     */
    function getMaintainer() public view returns (address);

    /**
     * @notice Checks whether the contract is safe to use and is not under quarantine
     * @dev Exposes information about exit games quarantine
     * @param _contract Address of the exit game contract
     * @return boolean Whether the contract is safe to use and is not under quarantine
     */
    function isExitGameSafeToUse(address _contract) public view returns (bool) {
        return _exitGameToTxType[_contract] != 0 && !_exitGameQuarantine.isQuarantined(_contract);
    }

    /**
     * @notice Registers an exit game within the PlasmaFramework. Only the maintainer can call the function.
     * @dev Emits ExitGameRegistered event to notify clients
     * @param _txType The tx type where the exit game wants to register
     * @param _contract Address of the exit game contract
     * @param _protocol The transaction protocol, either 1 for MVP or 2 for MoreVP
     */
    function registerExitGame(uint256 _txType, address _contract, uint8 _protocol) public onlyFrom(getMaintainer()) {
        require(_txType != 0, "Should not register with tx type 0");
        require(_contract != address(0), "Should not register with an empty exit game address");
        require(_exitGames[_txType] == address(0), "The tx type is already registered");
        require(_exitGameToTxType[_contract] == 0, "The exit game contract is already registered");
        require(Protocol.isValidProtocol(_protocol), "Invalid protocol value");

        _exitGames[_txType] = _contract;
        _exitGameToTxType[_contract] = _txType;
        _protocols[_txType] = _protocol;
        _exitGameQuarantine.quarantine(_contract);

        emit ExitGameRegistered(_txType, _contract, _protocol);
    }

    /**
     * @notice Public getter for retrieving protocol with tx type
     */
    function protocols(uint256 _txType) public view returns (uint8) {
        return _protocols[_txType];
    }

    /**
     * @notice Public getter for retrieving exit game address with tx type
     */
    function exitGames(uint256 _txType) public view returns (address) {
        return _exitGames[_txType];
    }

    /**
     * @notice Public getter for retrieving tx type with exit game address
     */
    function exitGameToTxType(address _exitGame) public view returns (uint256) {
        return _exitGameToTxType[_exitGame];
    }
}
