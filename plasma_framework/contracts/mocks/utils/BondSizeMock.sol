pragma solidity 0.5.11;

import "../../src/exits/utils/BondSize.sol";

contract BondSizeMock {
    using BondSize for BondSize.Params;

    BondSize.Params public bond;

    constructor (uint128 initialBondSize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier) public {
        bond = BondSize.buildParams(initialBondSize, lowerBoundDivisor, upperBoundMultiplier);
    }

    function bondSize() public view returns (uint128) {
        return bond.bondSize();
    }

    function updateBondSize(uint128 newBondSize) public {
        bond.updateBondSize(newBondSize);
    }
}
