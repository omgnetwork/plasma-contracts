pragma solidity 0.5.11;

import "../../src/utils/IsDeposit.sol";

contract IsDepositWrapper {
    using IsDeposit for IsDeposit.Predicate;

    IsDeposit.Predicate internal isDeposit;

    constructor(uint256 _childBlockInterval) public {
        isDeposit = IsDeposit.Predicate(_childBlockInterval);
    }

    function test(uint256 _blockNum) public view returns (bool) {
        return isDeposit.test(_blockNum);
    }
}
