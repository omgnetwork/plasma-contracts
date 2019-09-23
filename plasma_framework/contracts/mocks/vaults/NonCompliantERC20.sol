pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

// A 'NonCompliantERC20' token is one that uses an old version of the ERC20 standard,
// as described here https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
// Basically, this version does not return anything from `transfer` and `transferFrom`,
// whereas most modern implementions of ERC20 return a boolean to indicate success or failure.
contract NonCompliantERC20 {
    using SafeMath for uint256;

    mapping (address => uint256) private balances;
    mapping (address => mapping (address => uint256)) private allowances;
    uint256 private totalSupply;

    constructor(uint256 _initialAmount) public {
        balances[msg.sender] = _initialAmount;
        totalSupply = _initialAmount;
    }

    function balanceOf(address _account) public view returns (uint256) {
        return balances[_account];
    }

    function transfer(address _to, uint _value) public {
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
    }

    function transferFrom(address _from, address _to, uint _value) public {
        uint256 _allowance = allowances[_from][msg.sender];

        balances[_to] = balances[_to].add(_value);
        balances[_from] = balances[_from].sub(_value);
        allowances[_from][msg.sender] = _allowance.sub(_value);
    }

    function approve(address _spender, uint _value) public {
        allowances[msg.sender][_spender] = _value;
    }

    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {
        return allowances[_owner][_spender];
    }
}
