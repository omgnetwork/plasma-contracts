pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../src/utils/OnlyFromAddress.sol";
import "./interfaces/IQToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract QToken is IQToken, ERC20, ERC20Detailed, OnlyFromAddress {

    address public quasarContract;

    constructor(string memory name, string memory symbol, uint8 decimals, address owner) public ERC20Detailed(name, symbol, decimals) {
        quasarContract = owner;
    }

    /**
     * @dev Mint tokens for the address
     * @param account the address
     * @param amount the number of tokens to mint
    */
    function mint(address account, uint256 amount) external onlyFrom(quasarContract) {
        _mint(account, amount);
    }

    /**
     * @dev Burn specified tokens from the address
     * @param account the address
     * @param amount the number of tokens to burn
    */
    function burn(address account, uint256 amount) external onlyFrom(quasarContract) {
        _burn(account, amount);
    }
}
