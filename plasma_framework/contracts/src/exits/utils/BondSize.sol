pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

library BondSize {
    using SafeMath for uint256;

    struct Params {
        uint256 currentGasPrice;
        uint256 challengeGasCost;
        uint256 ewmaFactor;
        uint256 safetyFactor;
    }

    function bondSize(Params storage _self) internal view returns (uint256) {
        return _self.challengeGasCost
            .mul(_self.currentGasPrice)
            .mul(_self.safetyFactor)
            .div(100);
    }

    function updateGasPrice(Params storage _self) internal {
        _self.currentGasPrice = ewma(_self.currentGasPrice, tx.gasprice, _self.ewmaFactor);
    }

    function ewma(uint avg, uint value, uint factor) internal pure returns (uint) {
        return avg.mul(factor - 1).add(value).div(factor);
    }
}
