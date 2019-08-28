const OutputGuardHandlerRegistry = artifacts.require('PaymentChallengeStandardExit');
const PaymentChallengeStandardExit = artifacts.require('PaymentChallengeStandardExit');
const PaymentProcessStandardExit = artifacts.require('PaymentProcessStandardExit');
const PaymentStandardExitRouter = artifacts.require('PaymentStandardExitRouterMock');
const PaymentSpendingConditionExpected = artifacts.require('PaymentSpendingConditionExpected');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const PaymentSpendingConditionRevert = artifacts.require('PaymentSpendingConditionRevert');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../helpers/positions.js');
const {
    addressToOutputGuard, spentOnGas,
} = require('../../../helpers/utils.js');


contract('PaymentStandardExitRouter', ([_, alice, bob]) => {
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ZERO = 0;
    const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000000000';
    const EMPTY_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

    before('deploy and link with controller lib', async () => {
        const startStandardExit = await PaymentStartStandardExit.new();
        const challengeStandardExit = await PaymentChallengeStandardExit.new();
        const processStandardExit = await PaymentProcessStandardExit.new();

        await PaymentStandardExitRouter.link('PaymentStartStandardExit', startStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentChallengeStandardExit', challengeStandardExit.address);
        await PaymentStandardExitRouter.link('PaymentProcessStandardExit', processStandardExit.address);
    });

    describe('challengeStandardExit', () => {
        const getTestInputArgs = (outputType, outputGuard) => ({
            exitId: 123,
            outputType,
            outputGuard,
            challengeTxType: 1,
            challengeTx: EMPTY_BYTES,
            inputIndex: 0,
            witness: EMPTY_BYTES,
        });

        const getOutputTypeAndGuardHash = input => web3.utils.soliditySha3(
            { t: 'uint256', v: input.outputType },
            { t: 'bytes32', v: input.outputGuard },
        );

        const getTestExitData = (outputTypeAndGuardHash, exitTarget) => ({
            exitable: true,
            utxoPos: buildUtxoPos(1, 0, 0),
            outputId: web3.utils.sha3('random'),
            outputTypeAndGuardHash,
            token: ETH,
            exitTarget,
            amount: 66666,
        });

        const getExpectedConditionInputArgs = (input, exitData) => ({
            outputGuard: input.outputGuard,
            utxoPos: 0, // should not be used, see: https://github.com/omisego/plasma-contracts/pull/212
            outputId: web3.eth.abi.encodeParameter('uint256', exitData.utxoPos.toString()),
            spendingTx: input.challengeTx,
            inputIndex: input.inputIndex,
            witness: input.witness,
        });

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);
            const outputGuardParserRegistry = await OutputGuardHandlerRegistry.new();
            this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

            this.exitGame = await PaymentStandardExitRouter.new(
                this.framework.address, ethVault.address, erc20Vault.address,
                outputGuardParserRegistry.address, this.spendingConditionRegistry.address,
            );
        });

        it('should fail when exit for such exit id does not exists', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Such exit does not exist',
            );
        });

        it('should fail when output type mismatch exit data', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchInput = Object.assign({}, input);
            mismatchInput.outputType += 1;

            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(mismatchInput);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Either output type or output guard of challenge input args is invalid for the exit',
            );
        });

        it('should fail when output guard mismatch exit data', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const mismatchInput = Object.assign({}, input);
            mismatchInput.outputGuard = web3.utils.sha3(mismatchInput.outputGuard);

            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(mismatchInput);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Either output type or output guard of challenge input args is invalid for the exit',
            );
        });

        it('should fail when not able to find the spending condition contract', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Spending condition contract not found',
            );
        });

        it('should fail when spending condition contract returns false', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionFalse = await PaymentSpendingConditionFalse.new();
            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionFalse.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                'Spending condition failed',
            );
        });

        it('should fail when spending condition contract reverts', async () => {
            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionRevert = await PaymentSpendingConditionRevert.new();
            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionRevert.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            const revertMessage = await conditionRevert.revertMessage();
            await expectRevert(
                this.exitGame.challengeStandardExit(input),
                revertMessage,
            );
        });

        it('should call the Spending Condition contract with expected params given output type 0', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionExpected = await PaymentSpendingConditionExpected.new();
            const exitTarget = alice;
            const testExitData = getTestExitData(outputTypeAndGuardHash, exitTarget);

            // Spending condition mock reverts when it's called with arguments
            // that does not match expectedConditionInput
            const expectedConditionInput = getExpectedConditionInputArgs(input, testExitData);
            await conditionExpected.setExpected(expectedConditionInput);

            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionExpected.address,
            );

            await this.exitGame.setExit(input.exitId, testExitData);

            await this.exitGame.challengeStandardExit(input);
            const exitData = await this.exitGame.standardExits(input.exitId);
            expect(exitData.exitable).to.be.false;
        });

        it('should call the Spending Condition contract with expected params given output type non 0', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const outputType = 1;
            const dummyOutputGuard = `0x${Array(64).fill(1).join('')}`;
            const input = getTestInputArgs(outputType, dummyOutputGuard);
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionExpected = await PaymentSpendingConditionExpected.new();
            const exitTarget = alice;
            const testExitData = getTestExitData(outputTypeAndGuardHash, exitTarget);

            // Spending condition mock reverts when it's called with arguments
            // that does not match expectedConditionInput
            const expectedConditionInput = getExpectedConditionInputArgs(input, testExitData);
            await conditionExpected.setExpected(expectedConditionInput);

            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionExpected.address,
            );

            await this.exitGame.setExit(input.exitId, testExitData);

            await this.exitGame.challengeStandardExit(input);
            const exitData = await this.exitGame.standardExits(input.exitId);
            expect(exitData.exitable).to.be.false;
        });

        it('should delete the exit data when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            await this.exitGame.challengeStandardExit(input);

            const exitData = await this.exitGame.standardExits(input.exitId);
            Object.values(exitData).forEach((val) => {
                expect(val).to.be.oneOf([false, '0', EMPTY_BYTES32, constants.ZERO_ADDRESS]);
            });
        });

        it('should transfer the standard exit bond to challenger when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, getTestExitData(outputTypeAndGuardHash, alice));

            const preBalance = new BN(await web3.eth.getBalance(bob));

            const tx = await this.exitGame.challengeStandardExit(
                input, { from: bob },
            );

            const actualPostBalance = new BN(await web3.eth.getBalance(bob));
            const expectedPostBalance = preBalance
                .add(new BN(STANDARD_EXIT_BOND))
                .sub(await spentOnGas(tx.receipt));

            expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
        });

        it('should emit ExitChallenged event when successfully challenged', async () => {
            await this.exitGame.depositFundForTest({ value: STANDARD_EXIT_BOND });

            const input = getTestInputArgs(OUTPUT_TYPE_ZERO, addressToOutputGuard(alice));
            const outputTypeAndGuardHash = getOutputTypeAndGuardHash(input);
            const testExitData = getTestExitData(outputTypeAndGuardHash, alice);

            const conditionTrue = await PaymentSpendingConditionTrue.new();
            await this.spendingConditionRegistry.registerSpendingCondition(
                input.outputType, input.challengeTxType, conditionTrue.address,
            );

            await this.exitGame.setExit(input.exitId, testExitData);

            const { receipt } = await this.exitGame.challengeStandardExit(input);

            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentChallengeStandardExit,
                'ExitChallenged',
                { utxoPos: new BN(testExitData.utxoPos) },
            );
        });
    });
});
