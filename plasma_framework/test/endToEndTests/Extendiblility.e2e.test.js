const PlasmaFramework = artifacts.require('PlasmaFramework');
const config = require('../../config.js');

contract('Extendibility of the PlasmaFramework', () => {
    before(async () => {
        this.framework = await PlasmaFramework.deployed();
        this.ethVault = await this.plasmaFramework.vaults(config.registerKeys.vaultId.eth);
        this.paymentExitGame = await this.plasmaFramework.exitGames(config.registerKeys.txTypes.payment);
    });

    describe('Given PlasmaFramework, ETH Vault and PaymentExitGame deployed', () => {
        describe('When Maintainer registers new Exit Game contracts for PaymentExitGame V2 and DEX (mock)', () => {
            describe('And then waits for 3 weeks', () => {
                describe('Given Alice deposited with ETH via Payment transaction', () => {
                    describe('When Alice transfers the Payment transaction to Payment V2 transaction', () => {
                        describe('And then transfer from Payment V2 to DEX (mock)', () => {
                            describe('When Alice tries to exit the Payment transaction', () => {
                                it('should be challenged successfully since spent by Payment V2 tx', async () => {

                                });
                            });

                            describe('When Alice tries to exit the Payment V2 transaction', () => {
                                it('should be challenged successfully since spent by DEX (mock) tx', async () => {

                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
