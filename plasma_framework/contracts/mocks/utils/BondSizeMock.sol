pragma solidity ^0.5.0;

import "../../src/exits/utils/BondSize.sol";

contract BondSizeMock {
    using BondSize for BondSize.Params;

    BondSize.Params private _bondSize;

    event Updated(uint256 gasPrice);

    constructor (
        uint256 _initialGasPrice,
        uint128 _targetGasCost,
        uint64 _ewmaFactor,
        uint64 _safetyFactor
    ) public {
        _bondSize = BondSize.Params({
            currentGasPrice: _initialGasPrice,
            targetGasCost: _targetGasCost,
            ewmaFactor: _ewmaFactor,
            safetyFactor: _safetyFactor
        });
    }

    function bondSize() public view returns (uint) {
        return _bondSize.bondSize();
    }

    function updateGasPrice() public {
        _bondSize.updateGasPrice(tx.gasprice);

        emit Updated(tx.gasprice);
    }
}
