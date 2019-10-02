pragma solidity 0.5.11;

import "../../src/exits/utils/BondSize.sol";

contract BondSizeMock {
    using BondSize for BondSize.Params;

    BondSize.Params public bond;

    constructor (uint128 _initialBondSize, uint16 _lowerBoundDivisor, uint16 _upperBoundMultiplier) public {
        bond = BondSize.buildParams(_initialBondSize, _lowerBoundDivisor, _upperBoundMultiplier);
    }

    function bondSize() public view returns (uint128) {
        return bond.bondSize();
    }

    function updateBondSize(uint128 newBondSize) public {
        bond.updateBondSize(newBondSize);
    }
}
