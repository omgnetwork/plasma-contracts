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
    address private maintainer;

    event ExitGameRegistered(
        uint256 txType,
        address exitGameAddress,
        uint8 protocol
    );

    /**
     * @dev For each new exit game contract, it should take at least 3 * minExitPeriod to start take effect to protect existing transactions.
     *      see: https://github.com/omisego/plasma-contracts/issues/172
     *           https://github.com/omisego/plasma-contracts/issues/197
     */
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames, address _maintainer)
        public
    {
        _exitGameQuarantine.quarantinePeriod = 3 * _minExitPeriod;
        _exitGameQuarantine.immunitiesRemaining = _initialImmuneExitGames;
        maintainer = _maintainer;
    }

    /**
     * @notice modifier to check the call is from a non-quarantined exit game
     */
    modifier onlyFromNonQuarantinedExitGame() {
        require(_exitGameToTxType[msg.sender] != 0, "Not being called by registered exit game contract");
        require(!_exitGameQuarantine.isQuarantined(msg.sender), "ExitGame is quarantined.");
        _;
    }

    /**
     * @notice Checks whether the contract is safe to use and is not under quarantine
     * @dev Exposes information about exit games quarantine
     * @param _contract address of the exit game contract
     * @return boolean whether the contract is safe to use and is not under quarantine.
     */
    function isExitGameSafeToUse(address _contract) public view returns (bool) {
        return _exitGameToTxType[_contract] != 0 && !_exitGameQuarantine.isQuarantined(_contract);
    }

    /**
     * @notice Register an exit game within the PlasmaFramework. The function can only be called by the maintainer.
     * @dev emits ExitGameRegistered event to notify clients
     * @param _txType tx type that the exit game want to register to.
     * @param _contract address of the exit game contract.
     * @param _protocol protocol of the transaction, 1 for MVP and 2 for MoreVP.
     */
    function registerExitGame(uint256 _txType, address _contract, uint8 _protocol) public onlyFrom(maintainer) {
        require(_txType != 0, "should not register with tx type 0");
        require(_contract != address(0), "should not register with an empty exit game address");
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
     * @notice public getter for getting protocol with tx type
     */
    function protocols(uint256 _txType) public view returns (uint8) {
        return _protocols[_txType];
    }

    /**
     * @notice public getter for getting exit game address with tx type
     */
    function exitGames(uint256 _txType) public view returns (address) {
        return _exitGames[_txType];
    }

    /**
     * @notice public getter for getting tx type with exit game address
     */
    function exitGameToTxType(address _exitGame) public view returns (uint256) {
        return _exitGameToTxType[_exitGame];
    }
}
