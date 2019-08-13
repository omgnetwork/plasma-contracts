pragma solidity ^0.5.0;

import "../../src/exits/payment/BondSize.sol";

contract BondSizeMock {
    using BondSize for BondSize.Params;

    BondSize.Params private _bondSize;

    event Updated(uint256 gasPrice);

    constructor (
        uint256 _initialGasPrice,
        uint256 _challengeGasCost,
        uint256 _ewmaFactor,
        uint256 _safetyFactor
    ) public {
        _bondSize = BondSize.Params({
            currentGasPrice: _initialGasPrice,
            challengeGasCost: _challengeGasCost,
            ewmaFactor: _ewmaFactor,
            safetyFactor: _safetyFactor
        });
    }

    function bondSize() public view returns (uint) {
        return _bondSize.bondSize();
    }

    function updateGasPrice() public {
        _bondSize.updateGasPrice();

        emit Updated(tx.gasprice);
    }
}
