pragma solidity ^0.5.0;

interface IEthVault {
    function withdraw(address payable _target, uint256 _amount) external;
}
