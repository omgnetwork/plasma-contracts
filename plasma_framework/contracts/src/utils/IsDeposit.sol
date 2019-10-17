pragma solidity 0.5.11;

library IsDeposit {
    struct Predicate {
        uint256 childBlockInterval;
    }

    /**
     * @notice Tests whether the given block number belongs to a deposit block
     */
    function test(Predicate memory _predicate, uint256 _blockNum) internal pure returns (bool) {
        return _blockNum % _predicate.childBlockInterval != 0;
    }
}
