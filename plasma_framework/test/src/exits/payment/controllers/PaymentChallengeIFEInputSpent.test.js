const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const SpendingConditionMock = artifacts.require('SpendingConditionMock');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const ExitId = artifacts.require('ExitIdWrapper');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const Attacker = artifacts.require('FallbackFunctionFailAttacker');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const {
    TX_TYPE, OUTPUT_TYPE, CHILD_BLOCK_INTERVAL, VAULT_ID,
    PROTOCOL, SAFE_GAS_STIPEND, EMPTY_BYTES_32,
} = require('../../../../helpers/constants.js');
const { buildUtxoPos } = require('../../../../helpers/positions.js');
const { createInputTransaction, createInFlightTx } = require('../../../../helpers/ife.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const { spentOnGas, computeNormalOutputId, getOutputId } = require('../../../../helpers/utils.js');

contract('PaymentChallengeIFEInputSpent', ([_, alice, inputOwner, outputOwner, challenger, otherAddress]) => {
    const DUMMY_IFE_BOND_SIZE = 31415926535;
    const PIGGYBACK_BOND = 31415926535;
    const PROCESS_EXIT_BOUNTY = 500000000000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const ETH = constants.ZERO_ADDRESS;
    const INPUT_TX_AMOUNT = 123456;
    const BLOCK_NUMBER = 5000;
    const OUTPUT_TYPE_INPUT_TX = 3;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const deleteInFlightExit = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('deploy helper contracts', async () => {
        this.exitIdHelper = await ExitId.new();

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    describe('challenge in-flight exit input spent', () => {
        // This is the transaction whose output is the input piggyback in the IFE.
        function buildInputTx() {
            const tx = createInputTransaction(
                [
                    buildUtxoPos(BLOCK_NUMBER - CHILD_BLOCK_INTERVAL, 4, 3),
                    buildUtxoPos(BLOCK_NUMBER - CHILD_BLOCK_INTERVAL, 10, 2),
                ],
                // different output type for an input tx to check if proper spending codition is used
                OUTPUT_TYPE_INPUT_TX,
                inputOwner,
                INPUT_TX_AMOUNT,
            );

            const txBytes = web3.utils.bytesToHex(tx.rlpEncoded());
            const outputIndex = 0;

            return {
                tx,
                txBytes,
                outputIndex,
                utxoPos: buildUtxoPos(BLOCK_NUMBER, 5, outputIndex),
            };
        }

        // Sets up an IFE tx using inputTx as an input, starts the IFE and piggybacks on the input.
        const buildPiggybackInputData = async (inputTx) => {
            const outputAmount = 997;

            const firstInput = createInputTransaction(
                [buildUtxoPos(BLOCK_NUMBER, 3, 0)],
                OUTPUT_TYPE.PAYMENT,
                outputOwner,
                334455,
            );
            const firstInputUtxoPos = buildUtxoPos(BLOCK_NUMBER, 66, 0);

            const inFlightTx = createInFlightTx(
                [firstInput, inputTx.tx],
                [firstInputUtxoPos, inputTx.utxoPos],
                OUTPUT_TYPE.PAYMENT,
                alice,
                outputAmount,
            );
            const rlpInFlightTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const emptyWithdrawData = {
                outputId: EMPTY_BYTES_32,
                outputGuard: constants.ZERO_ADDRESS,
                exitTarget: constants.ZERO_ADDRESS,
                token: constants.ZERO_ADDRESS,
                amount: 0,
                piggybackBondSize: 0,
                bountySize: 0,
            };

            const inFlightExitData = {
                exitStartTimestamp: (await time.latest()).toNumber(),
                exitMap: 0,
                position: buildUtxoPos(BLOCK_NUMBER, 0, 0),
                bondOwner: alice,
                bondSize: DUMMY_IFE_BOND_SIZE,
                oldestCompetitorPosition: 0,
                inputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 999,
                    piggybackBondSize: PIGGYBACK_BOND,
                    bountySize: PROCESS_EXIT_BOUNTY,
                }, {
                    outputId: getOutputId(inputTx.txBytes, inputTx.utxoPos),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: INPUT_TX_AMOUNT,
                    piggybackBondSize: PIGGYBACK_BOND,
                    bountySize: PROCESS_EXIT_BOUNTY,
                }, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    outputGuard: web3.utils.sha3('dummy output guard'),
                    exitTarget: outputOwner,
                    token: ETH,
                    amount: outputAmount,
                    piggybackBondSize: PIGGYBACK_BOND,
                    bountySize: PROCESS_EXIT_BOUNTY,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
            };

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlightTxBytes);

            return {
                inFlightTx: rlpInFlightTxBytes,
                exitId,
                inFlightExitData,
            };
        };

        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            const ethVault = await SpyEthVault.new(this.framework.address);
            const erc20Vault = await SpyErc20Vault.new(this.framework.address);

            await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
            await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

            this.spendingConditionRegistry = await SpendingConditionRegistry.new();
            this.spendingCondition = await SpendingConditionMock.new();
            // lets the spending condition pass by default
            await this.spendingCondition.mockResult(true);
            await this.spendingConditionRegistry.registerSpendingCondition(
                OUTPUT_TYPE_INPUT_TX, TX_TYPE.PAYMENT, this.spendingCondition.address,
            );

            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                this.spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentInFlightExitRouter.new();
            await this.exitGame.bootInternal(exitGameArgs);

            await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

            // Create the input tx
            this.inputTx = buildInputTx();

            await this.framework.setBlock(BLOCK_NUMBER, web3.utils.sha3('dummy root'), 0);

            this.piggybackBondSize = await this.exitGame.piggybackBondSize();

            this.processExitBountySize = await this.exitGame.processInFlightExitBountySize();

            // Set up the piggyback data
            this.testData = await buildPiggybackInputData(this.inputTx);
            await this.exitGame.setInFlightExit(this.testData.exitId, this.testData.inFlightExitData);

            // Piggyback the second input
            await this.exitGame.setInFlightExitInputPiggybacked(this.testData.exitId, 1, {
                from: inputOwner,
                value: this.piggybackBondSize.add(this.processExitBountySize),
            });

            // Create a transaction that spends the same input
            const challengingTx = createInputTransaction(
                [this.inputTx.utxoPos],
                OUTPUT_TYPE.PAYMENT,
                outputOwner,
                789,
            );

            this.inFlightTxNotPiggybackedIndex = 0;
            this.inFlightTxPiggybackedIndex = 1;

            this.challengeArgs = {
                inFlightTx: this.testData.inFlightTx,
                inFlightTxInputIndex: this.inFlightTxPiggybackedIndex,
                challengingTx: web3.utils.bytesToHex(challengingTx.rlpEncoded()),
                challengingTxInputIndex: 0,
                challengingTxWitness: web3.utils.utf8ToHex('dummy witness'),
                inputTx: this.inputTx.txBytes,
                inputUtxoPos: this.inputTx.utxoPos,
                senderData: web3.utils.keccak256(challenger),
            };
        });

        it('should fail when paying out piggyback bond fails', async () => {
            const attacker = await Attacker.new();
            this.challengeArgs.senderData = web3.utils.keccak256(attacker.address);

            await expectRevert(
                this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: attacker.address }),
                'SafeEthTransfer: failed to transfer ETH',
            );
        });

        describe('after successfully challenged IFE input spent', () => {
            beforeEach(async () => {
                this.challengerPreBalance = new BN(await web3.eth.getBalance(challenger));
                this.challengeTx = await this.exitGame.challengeInFlightExitInputSpent(
                    this.challengeArgs, { from: challenger },
                );
            });

            it('should emit InFlightExitInputBlocked event', async () => {
                await expectEvent.inLogs(
                    this.challengeTx.logs,
                    'InFlightExitInputBlocked',
                    {
                        challenger,
                        txHash: web3.utils.sha3(this.challengeArgs.inFlightTx),
                        inputIndex: new BN(this.challengeArgs.inFlightTxInputIndex),
                    },
                );
            });

            it('should remove the input from piggybacked', async () => {
                const exits = await this.exitGame.inFlightExits([this.testData.exitId]);
                expect(new BN(exits[0].exitMap)).to.be.bignumber.equal(new BN(0));
            });

            it('should pay the piggyback bond plus exit bounty to the challenger', async () => {
                const actualPostBalance = new BN(await web3.eth.getBalance(challenger));
                const expectedPostBalance = this.challengerPreBalance
                    .add(new BN(PIGGYBACK_BOND))
                    .add(new BN(PROCESS_EXIT_BOUNTY))
                    .sub(await spentOnGas(this.challengeTx.receipt));

                expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
            });
        });

        describe('check exitMap before and after challenge', () => {
            beforeEach(async () => {
                // Piggyback input0 as well.
                await this.exitGame.setInFlightExitInputPiggybacked(this.testData.exitId, 0, {
                    from: inputOwner,
                    value: this.piggybackBondSize.add(this.processExitBountySize),
                });
            });

            it('should remove the input from piggybacked', async () => {
                // Before the challenge, both inputs should be in the exitMap
                let exits = await this.exitGame.inFlightExits([this.testData.exitId]);
                expect(new BN(exits[0].exitMap)).to.be.bignumber.equal(new BN(0b11));

                await this.exitGame.challengeInFlightExitInputSpent(
                    this.challengeArgs, { from: challenger },
                );

                // After the challenge, only input 1 should be in the exitMap
                exits = await this.exitGame.inFlightExits([this.testData.exitId]);
                expect(new BN(exits[0].exitMap)).to.be.bignumber.equal(new BN(0b01));
            });
        });

        describe('failures', () => {
            it('should fail when ife not started', async () => {
                this.challengeArgs.inFlightTx = this.challengeArgs.challengingTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'In-flight exit does not exist',
                );
            });

            it('should fail when the indexed input has not been piggybacked', async () => {
                this.challengeArgs.inFlightTxInputIndex = this.inFlightTxNotPiggybackedIndex;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'The indexed input has not been piggybacked',
                );
            });

            it('should fail when challenging tx is the same as in-flight one', async () => {
                this.challengeArgs.challengingTx = this.challengeArgs.inFlightTx;
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'The challenging transaction is the same as the in-flight transaction',
                );
            });

            it('should fail when the challenging transaction input index is incorrect', async () => {
                const challengingTx = createInputTransaction(
                    [buildUtxoPos(BLOCK_NUMBER - CHILD_BLOCK_INTERVAL, 4, 3), this.inputTx.utxoPos],
                    OUTPUT_TYPE.PAYMENT,
                    outputOwner,
                    789,
                );
                this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());
                this.challengeArgs.challengingTxInputIndex = 0;
                // The spending condition will fail if the challengingTxInputIndex does not point to
                // the correct inputTx output
                await this.spendingCondition.mockResult(false);
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition failed',
                );
            });

            it('should fail when challenging tx is not of MoreVP protocol', async () => {
                const newTxType = 999;
                const dummyExitGameForNewTxType = await ExitId.new();
                this.framework.registerExitGame(newTxType, dummyExitGameForNewTxType.address, PROTOCOL.MVP);

                const outputId = computeNormalOutputId(this.challengeArgs.inputTx, 0);
                const challengingTxOutput = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 123, alice, ETH);
                const challengingTx = new PaymentTransaction(newTxType, [outputId], [challengingTxOutput]);

                this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'MoreVpFinalization: not a MoreVP protocol tx',
                );
            });

            it('should fail when the spent input is not the same as piggybacked input', async () => {
                // create a different input tx
                const anotherTx = createInputTransaction(
                    [buildUtxoPos(BLOCK_NUMBER, 3, 0)],
                    OUTPUT_TYPE.PAYMENT,
                    outputOwner,
                    123,
                );
                this.challengeArgs.inputTx = web3.utils.bytesToHex(anotherTx.rlpEncoded());
                this.challengeArgs.inputUtxoPos = buildUtxoPos(BLOCK_NUMBER, 50, 0);
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spent input is not the same as piggybacked input',
                );
            });

            it('should fail when spending condition for given output is not registered', async () => {
                const newTxType = 999;
                const dummyExitGameForNewTxType = await ExitId.new();
                this.framework.registerExitGame(newTxType, dummyExitGameForNewTxType.address, PROTOCOL.MORE_VP);

                const outputId = computeNormalOutputId(this.challengeArgs.inputTx, 0);
                const challengingTxOutput = new PaymentTransactionOutput(OUTPUT_TYPE.PAYMENT, 123, alice, ETH);
                const challengingTx = new PaymentTransaction(newTxType, [outputId], [challengingTxOutput]);

                this.challengeArgs.challengingTx = web3.utils.bytesToHex(challengingTx.rlpEncoded());
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition contract not found',
                );
            });

            it('should fail when spending condition is not met', async () => {
                await this.spendingCondition.mockResult(false);
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: challenger }),
                    'Spending condition failed',
                );
            });

            it('should fail when senderData is incorrect', async () => {
                await expectRevert(
                    this.exitGame.challengeInFlightExitInputSpent(this.challengeArgs, { from: otherAddress }),
                    'Incorrect senderData',
                );
            });
        });
    });
});
