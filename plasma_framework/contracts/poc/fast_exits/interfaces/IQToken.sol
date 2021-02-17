pragma solidity 0.5.11;

interface IQToken {
    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 value) external; 
}
