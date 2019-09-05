const ExpectedOutputGuardHandler = artifacts.require('ExpectedOutputGuardHandler');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const {
    TX_TYPE, OUTPUT_TYPE, PROTOCOL, EMPTY_BYTES, EMPTY_BYTES_32,
} = require('../../../helpers/constants.js');
const { buildUtxoPos, UtxoPos } = require('../../../helpers/positions.js');
const {
    addressToOutputGuard, spentOnGas, computeNormalOutputId,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');


contract('PaymentStandardExitRouter', ([_, alice, bob]) => {
    const ETH = constants.ZERO_ADDRESS;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const TEST_AMOUNT = 666666;
    const TEST_BLOCK_NUM = 1000;
    const TEST_OUTPUT_INDEX = 0;

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    describe('challengeStandardExit', () => {
        const getTestInputArgs = (outputType, ouputOwner) => {
            const output = new PaymentTransactionOutput(TEST_AMOUNT, addressToOutputGuard(ouputOwner), ETH);
            const txObj = new PaymentTransaction(outputType, [0], [output]);
            const tx = web3.utils.bytesToHex(txObj.rlpEncoded());

            return {
                exitId: 123,
                outputType,
                exitingTx: tx,
                challengeTxType: TX_TYPE.PAYMENT,
                challengeTx: web3.utils.utf8ToHex('dummy challenge tx'),
                inputIndex: 0,
                witness: web3.utils.utf8ToHex('dummy witness'),
                spendingConditionOptionalArgs: web3.utils.utf8ToHex('dummy optional args'),
                outputGuardPreimage: web3.utils.utf8ToHex('dummy outputguard preimage'),
                challengeTxPos: 0,
                challengeTxInclusionProof: EMPTY_BYTES_32,
                challengeTxConfirmSig: web3.utils.utf8ToHex('dummy confirm sig'),
            };
        };

        const getTestExitData = (args, exitTarget, bondSize) => ({
            exitable: true,
            utxoPos: buildUtxoPos(TEST_BLOCK_NUM, 0, TEST_OUTPUT_INDEX),
            outputId: computeNormalOutputId(args.exitingTx, TEST_OUTPUT_INDEX),
            token: ETH,
            exitTarget,
            amount: TEST_AMOUNT,
            bondSize: bondSize.toString(),
        });

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            this.ethVault = await SpyEthVault.new(this.framework.address);
            this.erc20Vault = await SpyErc20Vault.new(this.framework.address);
            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
            this.outputGuardHandler = await ExpectedOutputGuardHandler.new();
            await this.outputGuardHandler.mockIsValid(true);
            await this.outputGuardHandler.mockGetConfirmSigAddress(constants.ZERO_ADDRESS);

            this.spendingConditionRegistry = await SpendingConditionRegistry.new();
            this.spendingCondition = await SpendingConditionMock.new();
            // let's the spending condition pass by default
            await this.spendingCondition.mockResult(true);

            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, this.ethVault.address, this.erc20Vault.address,
                this.outputGuardHandlerRegistry.address, this.spendingConditionRegistry.address,
            );
            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

            this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
        });

        describe('When spending condition not registered', () => {
            beforeEach(async () => {
                await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                    OUTPUT_TYPE.PAYMENT, this.outputGuardHandler.address,
                );
            });

            it('should fail by not able to find the spending condition contract', async () => {
                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);
                const exitData = getTestExitData(args, alice, this.startStandardExitBondSize);
                await this.exitGame.setExit(args.exitId, exitData);

                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Spending condition contract not found',
                );
            });
        });

        describe('When output guard handler not registered', () => {
            beforeEach(async () => {
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, this.spendingCondition.address,
                );
            });

            it('should fail by not able to find the output guard handler contract', async () => {
                const nonRegisteredOutputType = 3;
                const args = getTestInputArgs(nonRegisteredOutputType, alice);
                const exitData = getTestExitData(args, alice, this.startStandardExitBondSize);
                await this.exitGame.setExit(args.exitId, exitData);

                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Failed to get the outputGuardHandler of the output type',
                );
            });
        });

        describe('Given everything registered', () => {
            beforeEach(async () => {
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE.PAYMENT, TX_TYPE.PAYMENT, this.spendingCondition.address,
                );

                await this.outputGuardHandlerRegistry.registerOutputGuardHandler(
                    OUTPUT_TYPE.PAYMENT, this.outputGuardHandler.address,
                );
            });

            it('should fail when exit for such exit id does not exists', async () => {
                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);
                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Such exit does not exist',
                );
            });

            it('should fail when output guard related info is not valid', async () => {
                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);

                await this.outputGuardHandler.mockIsValid(false);

                await this.exitGame.setExit(args.exitId, getTestExitData(args, alice, this.startStandardExitBondSize));

                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Output guard information is invalid',
                );
            });

            it('should fail when challenge tx is not protocol finalized', async () => {
                const dummyExitGame = await PaymentStandardExitRouter.new(
                    this.framework.address, this.ethVault.address, this.erc20Vault.address,
                    this.outputGuardHandlerRegistry.address, this.spendingConditionRegistry.address,
                );

                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);

                // the test data is only setup for MoreVp, MVP would fail for inclusion proof + confirm sig check
                const mvpTxType = 999;
                await this.framework.registerExitGame(mvpTxType, dummyExitGame.address, PROTOCOL.MVP);
                args.challengeTxType = mvpTxType;

                await this.exitGame.setExit(args.exitId, getTestExitData(args, alice, this.startStandardExitBondSize));

                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Challenge transaction is not protocol finalized',
                );
            });

            it('should fail when spending condition contract returns false', async () => {
                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);
                await this.spendingCondition.mockResult(false);

                await this.exitGame.setExit(args.exitId, getTestExitData(args, alice, this.startStandardExitBondSize));

                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Spending condition failed',
                );
            });

            it('should fail when spending condition contract reverts', async () => {
                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);

                await this.spendingCondition.mockRevert();

                await this.exitGame.setExit(args.exitId, getTestExitData(args, alice, this.startStandardExitBondSize));

                await expectRevert(
                    this.exitGame.challengeStandardExit(args),
                    'Test spending condition reverts',
                );
            });

            it('should call the OutputGuardHandler contract with expected params', async () => {
                await this.exitGame.depositFundForTest({ value: this.startStandardExitBondSize });

                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);
                const exitData = getTestExitData(args, alice, this.startStandardExitBondSize);
                await this.exitGame.setExit(args.exitId, exitData);

                const expectedArgs = {
                    guard: addressToOutputGuard(alice),
                    outputType: OUTPUT_TYPE.PAYMENT,
                    preimage: args.outputGuardPreimage,
                };

                // would revert if called without the expected data
                await this.outputGuardHandler.shouldVerifyArgumentEquals(expectedArgs);
                await this.exitGame.challengeStandardExit(args);
            });

            it('should call the Spending Condition contract with expected params', async () => {
                await this.exitGame.depositFundForTest({ value: this.startStandardExitBondSize });

                const args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);
                const exitData = getTestExitData(args, alice, this.startStandardExitBondSize);
                await this.exitGame.setExit(args.exitId, exitData);

                const expectedArgs = {
                    inputTx: args.exitingTx,
                    outputIndex: (new UtxoPos(exitData.utxoPos)).outputIndex,
                    inputTxPos: (new UtxoPos(exitData.utxoPos)).txPos,
                    spendingTx: args.challengeTx,
                    inputIndex: args.inputIndex,
                    witness: args.witness,
                    optionalArgs: args.spendingConditionOptionalArgs,
                };

                // would revert if called without the expected data
                await this.spendingCondition.shouldVerifyArgumentEquals(expectedArgs);
                await this.exitGame.challengeStandardExit(args);
            });

            describe('When successfully challenged', () => {
                beforeEach(async () => {
                    await this.exitGame.depositFundForTest({ value: this.startStandardExitBondSize });

                    this.args = getTestInputArgs(OUTPUT_TYPE.PAYMENT, alice);
                    this.exitData = getTestExitData(this.args, alice, this.startStandardExitBondSize);

                    await this.exitGame.setExit(this.args.exitId, this.exitData);

                    this.preBalance = new BN(await web3.eth.getBalance(bob));
                    this.tx = await this.exitGame.challengeStandardExit(this.args, { from: bob });
                });

                it('should delete the exit data when successfully challenged', async () => {
                    const exitData = await this.exitGame.standardExits(this.args.exitId);
                    Object.values(exitData).forEach((val) => {
                        expect(val).to.be.oneOf([false, '0', EMPTY_BYTES_32, constants.ZERO_ADDRESS]);
                    });
                });

                it('should transfer the standard exit bond to challenger when successfully challenged', async () => {
                    const actualPostBalance = new BN(await web3.eth.getBalance(bob));
                    const expectedPostBalance = this.preBalance
                        .add(this.startStandardExitBondSize)
                        .sub(await spentOnGas(this.tx.receipt));

                    expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
                });

                it('should emit ExitChallenged event when successfully challenged', async () => {
                    await expectEvent.inTransaction(
                        this.tx.receipt.transactionHash,
                        PaymentChallengeStandardExit,
                        'ExitChallenged',
                        { utxoPos: new BN(this.exitData.utxoPos) },
                    );
                });
            });
        });
    });
});
