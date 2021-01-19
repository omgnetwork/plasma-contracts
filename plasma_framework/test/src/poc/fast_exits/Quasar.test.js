const Quasar = artifacts.require('Quasar');
const BlockController = artifacts.require('BlockControllerMock');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { TX_TYPE, OUTPUT_TYPE } = require('../../../helpers/constants.js');
const { buildUtxoPos } = require('../../../helpers/positions.js');


contract('Quasar', ([authority, quasarOwner, quasarMaintainer, alice]) => {
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 10;
    const INITIAL_IMMUNE_VAULTS = 1;
    const SAFE_BLOCK_MARGIN = 10;
    const WAITING_PERIOD = 3600;
    const BOND_VALUE = 100;

    const setupAllContracts = async () => {
        this.plasmaFramework = await BlockController.new(
            CHILD_BLOCK_INTERVAL,
            MIN_EXIT_PERIOD,
            INITIAL_IMMUNE_VAULTS,
            authority,
        );

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

        this.quasar = await Quasar.new(
            this.plasmaFramework.address,
            this.spendingConditionRegistry.address,
            quasarOwner,
            SAFE_BLOCK_MARGIN,
            WAITING_PERIOD,
            BOND_VALUE,
            { from: quasarMaintainer },
        );
    };

    describe('deposit', () => {
        beforeEach(setupAllContracts);

        it('should set the safe block margin', async () => {
            const testSafeBlockMargin = 57;
            await this.quasar.setSafeBlockMargin(
                testSafeBlockMargin,
                { from: quasarMaintainer },
            );

            const safeBlockMargin = await this.quasar.safeBlockMargin();
            expect(safeBlockMargin).to.be.bignumber.equal(new BN(testSafeBlockMargin));
        });

        it('should fail to set the safe block margin if not from quasarMaintainer', async () => {
            await expectRevert(
                this.quasar.setSafeBlockMargin(
                    1,
                    { from: alice },
                ),
                'Only the Quasar Maintainer can invoke this method',
            );
        });

        it('should fail to accept an exit from an output younger than the safe block margin', async () => {
            const dummyTx = '0x0';
            const dummyProof = '0x0';

            const nextPlasmaBlock = await this.plasmaFramework.nextChildBlock();
            const youngBlockNum = nextPlasmaBlock - CHILD_BLOCK_INTERVAL;
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
                'The UTXO is from a block later than the safe limit',
            );
        });
    });
});
