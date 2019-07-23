pragma solidity ^0.5.0;

interface IErc20Vault {
    function withdraw(address payable _target, address _token, uint256 _amount) external;
}
