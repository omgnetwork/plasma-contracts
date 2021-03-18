/* eslint-disable no-await-in-loop */
const Quasar = artifacts.require('QuasarPoolMock');
const QToken = artifacts.require('QToken');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const { BN, constants } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { TX_TYPE, OUTPUT_TYPE } = require('../../../helpers/constants.js');

contract('Quasar Pool', ([authority, quasarOwner, quasarMaintainer, supplierOne, supplierTwo, supplierThree, supplierFour, supplierFive]) => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAME = 1;
    const SAFE_BLOCK_MARGIN = 10;
    const BOND_VALUE = 100;
    const ETH = constants.ZERO_ADDRESS;

    const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    const setupAllContracts = async () => {
        this.plasmaFramework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
            INITIAL_IMMUNE_EXIT_GAME,
            { from: authority },
        );
        this.plasmaFramework.activateChildChain({ from: authority });
        this.childBlockInterval = await this.plasmaFramework.childBlockInterval();
        // Submit some blocks to have a safe block margin
        const DUMMY_BLOCK_HASH = web3.utils.sha3('dummy root');
        for (let i = 0; i < SAFE_BLOCK_MARGIN; i++) {
            await this.plasmaFramework.submitBlock(DUMMY_BLOCK_HASH, { from: authority });
        }

        this.spendingConditionRegistry = await SpendingConditionRegistry.new();
        this.spendingCondition = await SpendingConditionMock.new();
        // lets the spending condition pass by default
        await this.spendingCondition.mockResult(true);
        await this.spendingConditionRegistry.registerSpendingCondition(
            OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, this.spendingCondition.address,
        );
        this.erc20 = await ERC20Mintable.new();

        this.quasar = await Quasar.new(
            this.plasmaFramework.address,
            this.spendingConditionRegistry.address,
            quasarOwner,
            SAFE_BLOCK_MARGIN,
            BOND_VALUE,
            { from: quasarMaintainer },
        );

        this.qEth = await QToken.new('Quasar Ether', 'qETH', 18, this.quasar.address);
        await this.quasar.registerQToken(
            ETH,
            this.qEth.address,
            5000,
            { from: quasarMaintainer },
        );

        this.feeEth = (await this.quasar.tokenData(ETH)).quasarFee;
    };

    describe('Randomised Supply/Withdraw Flow', () => {
        before(setupAllContracts);

        describe('Supply/Withdraw Eth in between a random number of fee cycles', () => {
            before(async () => {
                const FEE_CYCLES = randomNum(50, 150);
                this.suppliers = [supplierOne, supplierTwo, supplierThree, supplierFour, supplierFive];

                for (let i = 0; i < FEE_CYCLES; i++) {
                    let noOfDepositors = randomNum(0, 5);

                    // if this is first round ensure at least one supplier
                    if (i === 0 && noOfDepositors === 0) {
                        noOfDepositors += 1;
                    }

                    // supply amount
                    for (let j = 0; j < noOfDepositors; j++) {
                        const amount = randomNum(40000000000000, 1230000000000000);
                        await this.quasar.addEthCapacity({ from: this.suppliers[j], value: amount });
                    }

                    if (noOfDepositors >= 2) {
                        const noOfWithdrawers = randomNum(0, noOfDepositors - 2);
                        for (let k = 0; k < noOfWithdrawers; k++) {
                            const supplierNumber = randomNum(0, noOfDepositors - 1);

                            // supplier[supplierNumber] withdraws
                            const qEthBalance = await this.qEth.balanceOf(this.suppliers[supplierNumber]);
                            await this.quasar.withdrawFunds(ETH, qEthBalance, { from: this.suppliers[supplierNumber] });
                        }
                    }

                    // the funds from pool are utilized and then reapyed
                    await this.quasar.utilizeQuasarPool(ETH, 0, { from: quasarOwner, value: this.feeEth });
                }
            });

            it('expected Pool Balance equal to Contract Balance', async () => {
                const contractBalance = new BN(await web3.eth.getBalance(this.quasar.address));
                const { poolSupply: expectedPoolSupply } = await this.quasar.tokenData(ETH);

                expect(contractBalance).to.be.bignumber.equal(expectedPoolSupply);
            });

            it('Allows everyone to get off pool with returns', async () => {
                // Attempting to withdraw all Q Tokens from pool now
                for (let i = 0; i < 5; i++) {
                    const supplierBalance = await this.qEth.balanceOf(this.suppliers[i]);
                    if (supplierBalance !== 0) {
                        // supplier #(i+1) withdraws
                        await this.quasar.withdrawFunds(ETH, supplierBalance, { from: this.suppliers[i] });
                    }
                }
            });

            it('No Residual qTokens', async () => {
                const contractBalance = new BN(await web3.eth.getBalance(this.quasar.address));
                /* eslint-disable no-console */
                console.log('\nContract Balance: ', contractBalance.toString(), ' wei');
                const contractQtokenBalance = await this.qEth.totalSupply();
                expect(contractQtokenBalance).to.be.bignumber.equal(new BN(0));
            });
        });
    });
});
