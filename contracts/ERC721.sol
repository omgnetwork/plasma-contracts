pragma solidity ^0.4.18;

/**
 * @title ERC721
 * @dev Simpler version of ERC721 interface
 * @dev see https://github.com/OpenZeppelin/openzeppelin-solidity/blob/07020e954475a4fdd36e0252e88717b60f790b71/contracts/token/ERC721/ERC721Basic.sol
 */
contract ERC721 {
    function transferFrom(address from, address to, uint256 value) public returns (bool);
}