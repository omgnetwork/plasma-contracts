const BondSizeMock = artifacts.require('BondSizeMock');
const { BN } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('BondSize', () => {
    beforeEach(async () => {
        this.initialGasPrice = 20000000000; // 20 gwei
        this.challengeGasCost = 300000;
        this.ewmaFactor = 2;
        this.safetyFactor = 100;

        this.contract = await BondSizeMock.new(
            this.initialGasPrice,
            this.challengeGasCost,
            this.ewmaFactor,
            this.safetyFactor,
        );

        this.initialBondSize = new BN(this.initialGasPrice)
            .muln(this.challengeGasCost)
            .muln(this.safetyFactor)
            .divn(100);
    });

    it('should return the initial bond size', async () => {
        const bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.equal(this.initialBondSize);
    });

    it('should lower the bond size when average gas price decreases', async () => {
        const LOW_GAS = new BN(this.initialGasPrice).divn(2);
        await this.contract.updateGasPrice({ gasPrice: LOW_GAS });
        const bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.lt(this.initialBondSize);
    });

    it('should raise the bond size when average gas price increases', async () => {
        const HIGH_GAS = new BN(this.initialGasPrice).muln(2);
        await this.contract.updateGasPrice({ gasPrice: HIGH_GAS });
        const bondSize = await this.contract.bondSize();
        expect(bondSize).to.be.bignumber.gt(this.initialBondSize);
    });
});
