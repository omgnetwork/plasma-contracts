const PlasmaFramework = artifacts.require('PlasmaFramework');
const EthVault = artifacts.require('EthVault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { OUTPUT_TYPE, TX_TYPE, SAFE_GAS_STIPEND } = require('../../helpers/constants.js');

contract('Vault', ([_, authority, maintainer, alice]) => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;
    const TOLERANCE_SECONDS = new BN(1);
    let vault;

    beforeEach('setup contracts - use EthVault to test public functions of Vault for simplicity', async () => {
        const framework = await PlasmaFramework.new(
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
            INITIAL_IMMUNE_EXIT_GAMES,
            authority,
            maintainer,
        );
        vault = await EthVault.new(framework.address, SAFE_GAS_STIPEND);
    });

    describe('setDepositVerifier / getEffectiveDepositVerifier', () => {
        it('should not allow for setting empty address as deposit verifier', async () => {
            await expectRevert(
                vault.setDepositVerifier(constants.ZERO_ADDRESS, { from: maintainer }),
                'Cannot set an empty address as deposit verifier',
            );
        });

        it('should fail when not set by maintainer', async () => {
            await expectRevert(
                vault.setDepositVerifier(constants.ZERO_ADDRESS, { from: alice }),
                'Caller address is unauthorized',
            );
        });

        describe('before any deposit verifier is set', async () => {
            it('should get empty address if nothing is set', async () => {
                expect(await vault.getEffectiveDepositVerifier()).to.equal(constants.ZERO_ADDRESS);
            });
        });

        describe('after the first deposit verifier is set', async () => {
            let firstDepositVerifier;
            let setFirstVerifierTx;

            beforeEach(async () => {
                firstDepositVerifier = await EthDepositVerifier.new(TX_TYPE.PAYMENT, OUTPUT_TYPE.PAYMENT);
                setFirstVerifierTx = await vault.setDepositVerifier(
                    firstDepositVerifier.address, { from: maintainer },
                );
            });

            it('should immediately take effect', async () => {
                expect(await vault.getEffectiveDepositVerifier()).to.equal(firstDepositVerifier.address);
            });

            it('should emit SetDepositVerifierCalled event', async () => {
                await expectEvent.inLogs(
                    setFirstVerifierTx.logs,
                    'SetDepositVerifierCalled',
                    { nextDepositVerifier: firstDepositVerifier.address },
                );
            });

            describe('when setting the second verifier', () => {
                let secondVerifier;
                let setSecondVerifierTx;

                beforeEach(async () => {
                    secondVerifier = await EthDepositVerifier.new(TX_TYPE.PAYMENT, OUTPUT_TYPE.PAYMENT);
                    setSecondVerifierTx = await vault.setDepositVerifier(secondVerifier.address, { from: maintainer });
                });

                it('should not take effect before 2 minExitPeriod has passed', async () => {
                    await time.increase(2 * MIN_EXIT_PERIOD - 1 - TOLERANCE_SECONDS);
                    expect(await vault.getEffectiveDepositVerifier()).to.equal(firstDepositVerifier.address);
                });

                it('should take effect after 2 minExitPeriod has passed', async () => {
                    await time.increase(2 * MIN_EXIT_PERIOD);
                    expect(await vault.getEffectiveDepositVerifier()).to.equal(secondVerifier.address);
                });

                it('should emit SetDepositVerifierCalled event', async () => {
                    await expectEvent.inLogs(
                        setSecondVerifierTx.logs,
                        'SetDepositVerifierCalled',
                        { nextDepositVerifier: secondVerifier.address },
                    );
                });
            });
        });
    });
});
