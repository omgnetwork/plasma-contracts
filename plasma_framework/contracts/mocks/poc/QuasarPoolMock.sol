pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../poc/fast_exits/Quasar.sol";

contract QuasarPoolMock is Quasar {

    constructor (
        address plasmaFrameworkContract, 
        address spendingConditionRegistryContract, 
        address _quasarOwner, 
        uint256 _safeBlockMargin, 
        uint256 _waitingPeriod, 
        uint256 _bondValue
    ) public Quasar(plasmaFrameworkContract, spendingConditionRegistryContract, _quasarOwner, _safeBlockMargin, _waitingPeriod, _bondValue) {
    }

    function utilizeQuasarPool(address token, uint256 amount) public payable {
        utilize(token, amount);
        tokenUsableCapacity[token] += msg.value;
    }
}
