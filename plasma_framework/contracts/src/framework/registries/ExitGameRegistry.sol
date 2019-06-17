pragma solidity ^0.5.0;

import "../modifiers/Operated.sol";

contract ExitGameRegistry is Operated {
    mapping(uint256 => address) private _exitGames;
    mapping(address => uint256) private _exitGameToTxType;

    modifier onlyFromExitGame() {
        require(_exitGameToTxType[msg.sender] != 0, "Not being called by registered exit game contract");
        _;
    }

    /**
     * @notice Register the exit game to Plasma framework. This can be only called by contract admin.
     * @param _txType tx type that the exit game want to register to.
     * @param _contract Address of the exit game contract.
     */
    function registerExitGame(uint256 _txType, address _contract) public onlyOperator {
        require(_exitGames[_txType] == address(0), "The tx type is already registered");
        require(_exitGameToTxType[_contract] == 0, "The exit game contract is already registered");

        _exitGames[_txType] = _contract;
        _exitGameToTxType[_contract] = _txType;
    }

    function exitGames(uint256 _txType) public view returns (address) {
        return _exitGames[_txType];
    }

    function exitGameToTxType(address _exitGame) public view returns (uint256) {
        return _exitGameToTxType[_exitGame];
    }
}
