pragma solidity ^0.5.0;

import "../../src/exits/utils/BondSize.sol";

contract BondSizeMock {
    using BondSize for BondSize.Params;

    BondSize.Params public bond;

    event Updated(uint128 bondSize);

    constructor (uint128 _initialBondSize) public {
        bond = BondSize.buildParams(_initialBondSize);
    }

    function bondSize() public view returns (uint) {
        return bond.bondSize();
    }

    function updateBondSize(uint128 newBondSize) public {
        bond.updateBondSize(newBondSize);

        emit Updated(newBondSize);
    }
}
