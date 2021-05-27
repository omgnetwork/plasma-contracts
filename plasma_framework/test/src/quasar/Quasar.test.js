const Quasar = artifacts.require('Quasar');
const QToken = artifacts.require('QToken');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const {
    BN, expectRevert, constants, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { TX_TYPE, OUTPUT_TYPE } = require('../../helpers/constants.js');
const { buildUtxoPos } = require('../../helpers/positions.js');


contract('Quasar', ([authority, quasarOwner, quasarMaintainer, alice]) => {
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAME = 1;
    const SAFE_BLOCK_MARGIN = 10;
    const BOND_VALUE = 100;
    const ETH = constants.ZERO_ADDRESS;

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
            // eslint-disable-next-line no-await-in-loop
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
        await this.erc20.mint(alice, 3000000);

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

        this.qErc20 = await QToken.new('Quasar Token', 'qERC', 18, this.quasar.address);
        await this.quasar.registerQToken(
            this.erc20.address,
            this.qErc20.address,
            5000,
            { from: quasarMaintainer },
        );
    };

    describe('safe block margin', () => {
        beforeEach(setupAllContracts);

        it('should set the safe block margin after the waiting period', async () => {
            const previousSafeBlockMargin = await this.quasar.getSafeBlockMargin();
            const testSafeBlockMargin = 57;
            await this.quasar.setSafeBlockMargin(
                testSafeBlockMargin,
                { from: quasarMaintainer },
            );

            let safeBlockMargin = await this.quasar.getSafeBlockMargin();
            expect(safeBlockMargin).to.be.bignumber.equal(new BN(previousSafeBlockMargin));

            await time.increase(time.duration.weeks(1));

            safeBlockMargin = await this.quasar.getSafeBlockMargin();
            expect(safeBlockMargin).to.be.bignumber.equal(new BN(testSafeBlockMargin));
        });

        it('should fail to set the safe block margin if not from quasarMaintainer', async () => {
            await expectRevert(
                this.quasar.setSafeBlockMargin(
                    1,
                    { from: alice },
                ),
                'Maintainer only',
            );
        });

        it('should fail to accept an exit from an output younger than the safe block margin', async () => {
            const dummyTx = '0x0';
            const dummyProof = '0x0';

            const nextPlasmaBlock = await this.plasmaFramework.nextChildBlock();
            const youngBlockNum = nextPlasmaBlock - this.childBlockInterval;
            const utxoPos = buildUtxoPos(youngBlockNum, 0, 0);

            await expectRevert(
                this.quasar.obtainTicket(
                    utxoPos,
                    dummyTx,
                    dummyProof,
                    {
                        from: alice,
                        value: BOND_VALUE,
                    },
                ),
                'Later than safe limit',
            );
        });
    });

    describe('Quasar Capacity', () => {
        before(setupAllContracts);

        describe('Supply Eth', () => {
            before(async () => {
                this.aliceSuppliedAmount = new BN(3000000);
                await this.quasar.addEthCapacity({ from: alice, value: this.aliceSuppliedAmount });
            });

            it('should update the pool supply', async () => {
                const quasarUsableCapacity = await this.quasar.tokenUsableCapacity(ETH);
                const { poolSupply } = await this.quasar.tokenData(ETH);

                expect(poolSupply).to.be.bignumber.equal(
                    quasarUsableCapacity,
                ).equal(this.aliceSuppliedAmount);
            });

            describe('Withdraw Eth', () => {
                before(async () => {
                    const aliceQTokenBalance = await this.qEth.balanceOf(alice);
                    await this.quasar.withdrawFunds(ETH, aliceQTokenBalance, { from: alice });
                });

                it('should update the pool supply', async () => {
                    const quasarUsableCapacity = await this.quasar.tokenUsableCapacity(ETH);
                    const aliceQTokenBalance = await this.qEth.balanceOf(alice);

                    expect(aliceQTokenBalance).to.be.bignumber.equal(new BN(0));
                    expect(quasarUsableCapacity).to.be.bignumber.equal(new BN(0));
                });
            });
        });

        describe('Supply Erc20', () => {
            before(async () => {
                this.aliceSuppliedAmount = new BN(3000000);
                await this.erc20.approve(this.quasar.address, this.aliceSuppliedAmount, { from: alice });
                await this.quasar.addTokenCapacity(this.erc20.address, this.aliceSuppliedAmount, { from: alice });
            });

            it('should update the pool supply', async () => {
                const quasarUsableCapacity = await this.quasar.tokenUsableCapacity(this.erc20.address);
                const { poolSupply } = await this.quasar.tokenData(this.erc20.address);

                expect(poolSupply).to.be.bignumber.equal(
                    quasarUsableCapacity,
                ).equal(this.aliceSuppliedAmount);
            });

            describe('Withdraw Erc20', () => {
                before(async () => {
                    const aliceQTokenBalance = await this.qErc20.balanceOf(alice);
                    await this.quasar.withdrawFunds(this.erc20.address, aliceQTokenBalance, { from: alice });
                });

                it('should update the pool supply', async () => {
                    const quasarUsableCapacity = await this.quasar.tokenUsableCapacity(this.erc20.address);
                    const aliceQTokenBalance = await this.qEth.balanceOf(alice);

                    expect(aliceQTokenBalance).to.be.bignumber.equal(new BN(0));
                    expect(quasarUsableCapacity).to.be.bignumber.equal(new BN(0));
                });
            });
        });
    });

    describe('qToken', () => {
        beforeEach(setupAllContracts);

        it('should register qToken for an erc20', async () => {
            this.newErc20 = await ERC20Mintable.new();
            this.newQErc20 = await QToken.new('Quasar New Token', 'qNERC', 18, this.quasar.address);
            await this.quasar.registerQToken(
                this.newErc20.address,
                this.newQErc20.address,
                5000,
                { from: quasarMaintainer },
            );

            const { qTokenAddress } = await this.quasar.tokenData(this.newErc20.address);
            expect(qTokenAddress).to.be.equal(this.newQErc20.address);
        });

        it('should not allow to replace registration', async () => {
            this.newErc20 = await ERC20Mintable.new();
            this.newQErc20 = await QToken.new('Quasar New Token', 'qNERC', 18, this.quasar.address);
            await this.quasar.registerQToken(
                this.newErc20.address,
                this.newQErc20.address,
                5000,
                { from: quasarMaintainer },
            );

            await expectRevert(
                this.quasar.registerQToken(
                    this.newErc20.address,
                    this.newQErc20.address,
                    5000,
                    { from: quasarMaintainer },
                ),
                'QToken already exists',
            );
        });

        it('should fail to register qToken if not called by the quasar Maintainer', async () => {
            this.newErc20 = await ERC20Mintable.new();
            this.newQErc20 = await QToken.new('Quasar New Token', 'qNERC', 18, this.quasar.address);

            await expectRevert(
                this.quasar.registerQToken(
                    this.newErc20.address,
                    this.newQErc20.address,
                    5000,
                    { from: alice },
                ),
                'Maintainer only',
            );
        });

        it('should fail to mint qToken if not called by quasar', async () => {
            await expectRevert(
                this.qEth.mint(
                    quasarMaintainer,
                    500,
                    { from: quasarMaintainer },
                ),
                'Caller address is unauthorized',
            );
        });

        it('should fail to burn qToken if not called by quasar', async () => {
            await expectRevert(
                this.qEth.burn(
                    quasarMaintainer,
                    500,
                    { from: quasarMaintainer },
                ),
                'Caller address is unauthorized',
            );
        });
    });

    describe('Quasar freeze during Byzantine state', () => {
        beforeEach(setupAllContracts);

        it('should fail to pause Quasar if not called by the quasar maintainer', async () => {
            await expectRevert(
                this.quasar.pauseQuasar(
                    { from: alice },
                ),
                'Maintainer only',
            );
        });

        it('should fail to obtain ticket if quasar is paused', async () => {
            await this.quasar.pauseQuasar({ from: quasarMaintainer });
            const dummyTx = '0x0';
            const dummyProof = '0x0';

            const safeBlockNum = await this.quasar.getLatestSafeBlock();
            const utxoPos = buildUtxoPos(safeBlockNum, 0, 0);

            await expectRevert(
                this.quasar.obtainTicket(
                    utxoPos,
                    dummyTx,
                    dummyProof,
                    {
                        from: alice,
                        value: BOND_VALUE,
                    },
                ),
                'Quasar paused',
            );
        });

        it('should allow quasar maintainer to un-freeze contract', async () => {
            await this.quasar.resumeQuasar({ from: quasarMaintainer });

            const pauseStatus = await this.quasar.isPaused();
            expect(pauseStatus).to.be.false;
        });
    });
});
