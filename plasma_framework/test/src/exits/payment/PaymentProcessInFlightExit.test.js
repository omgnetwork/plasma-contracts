/* eslint no-bitwise: ["error", { "allow": ["|"] }] */

const Attacker = artifacts.require('FallbackFunctionFailAttacker');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const TxFinalizationVerifier = artifacts.require('TxFinalizationVerifier');

const {
    BN, constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const {
    TX_TYPE, PROTOCOL, VAULT_ID,
} = require('../../../helpers/constants.js');
const { buildUtxoPos } = require('../../../helpers/positions.js');

contract('PaymentInFlightExitRouter', ([_, ifeBondOwner, inputOwner1, inputOwner2, inputOwner3, outputOwner1, outputOwner2, outputOwner3]) => {
    const MAX_INPUT_NUM = 4;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const TEST_INPUT_AMOUNT = 667;
    const TEST_OUTPUT_AMOUNT = 666;
    const TEST_OUTPUT_ID_FOR_INPUT_1 = web3.utils.sha3('dummy outputId of input 1');
    const TEST_OUTPUT_ID_FOR_INPUT_2 = web3.utils.sha3('dummy outputId of input 2');
    const TEST_OUTPUT_ID_FOR_INPUT_3 = web3.utils.sha3('dummy outputId of input 3');
    const TEST_OUTPUT_ID_FOR_OUTPUT_1 = web3.utils.sha3('dummy outputId of output 1');
    const TEST_OUTPUT_ID_FOR_OUTPUT_2 = web3.utils.sha3('dummy outputId of output 2');
    const TEST_OUTPUT_ID_FOR_OUTPUT_3 = web3.utils.sha3('dummy outputId of output 3');
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;
    let erc20;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('deploy dummy and helper contracts', async () => {
        erc20 = (await ERC20Mintable.new()).address;

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);

        this.txFinalizationVerifier = await TxFinalizationVerifier.new();
    });

    /**
     * This builds in-flight exit data with three inputs and outputs.
     * First two inputs and outputs would be of ETH.
     * The third input and output would be of ERC20.
     */
    const buildInFlightExitData = async (
        exitTargetInput1 = inputOwner1,
        exitTargetOutput1 = outputOwner1,
        bondOwner = ifeBondOwner,
    ) => {
        const emptyWithdrawData = {
            outputId: web3.utils.sha3('dummy output id'),
            exitTarget: constants.ZERO_ADDRESS,
            token: constants.ZERO_ADDRESS,
            amount: 0,
            piggybackBondSize: 0,
        };

        const inFlightExitData = {
            exitStartTimestamp: (await time.latest()).toNumber(),
            exitMap: 0,
            position: INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION,
            bondOwner,
            bondSize: this.startIFEBondSize.toString(),
            oldestCompetitorPosition: 0,
            inputs: [{
                outputId: TEST_OUTPUT_ID_FOR_INPUT_1,
                exitTarget: exitTargetInput1,
                token: ETH,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
            }, {
                outputId: TEST_OUTPUT_ID_FOR_INPUT_2,
                exitTarget: inputOwner2,
                token: ETH,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
            }, {
                outputId: TEST_OUTPUT_ID_FOR_INPUT_3,
                exitTarget: inputOwner3,
                token: erc20,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
            }, emptyWithdrawData],
            outputs: [{
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_1,
                exitTarget: exitTargetOutput1,
                token: ETH,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
            }, {
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_2,
                exitTarget: outputOwner2,
                token: ETH,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
            }, {
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_3,
                exitTarget: outputOwner3,
                token: erc20,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
            }, emptyWithdrawData],
        };

        return inFlightExitData;
    };

    describe('processInFlightExit', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            this.ethVault = await SpyEthVault.new(this.framework.address);
            this.erc20Vault = await SpyErc20Vault.new(this.framework.address);

            await this.framework.registerVault(VAULT_ID.ETH, this.ethVault.address);
            await this.framework.registerVault(VAULT_ID.ERC20, this.erc20Vault.address);

            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
            const spendingConditionRegistry = await SpendingConditionRegistry.new();

            this.exitGame = await PaymentInFlightExitRouter.new(
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                this.outputGuardHandlerRegistry.address,
                spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                this.txFinalizationVerifier.address,
                TX_TYPE.PAYMENT,
            );
            this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

            this.startIFEBondSize = await this.exitGame.startIFEBondSize();
            this.piggybackBondSize = await this.exitGame.piggybackBondSize();

            const maxNeededBond = this.startIFEBondSize.add(this.piggybackBondSize).muln(4);
            await this.exitGame.depositFundForTest({ value: maxNeededBond.toString() });
        });

        it('should omit the exit if the exit does not exist', async () => {
            const nonExistingExitId = 666;

            const { logs } = await this.exitGame.processExit(nonExistingExitId, VAULT_ID.ETH, ETH);
            await expectEvent.inLogs(
                logs,
                'InFlightExitOmitted',
                { exitId: new BN(nonExistingExitId), token: ETH },
            );
        });

        it('should omit the exit if any input spent already', async () => {
            const exit = await buildInFlightExitData();
            const dummyExitId = 666;
            await this.exitGame.setInFlightExit(dummyExitId, exit);

            await this.exitGame.proxyFlagOutputSpent(TEST_OUTPUT_ID_FOR_INPUT_1);

            const { logs } = await this.exitGame.processExit(dummyExitId, VAULT_ID.ETH, ETH);
            await expectEvent.inLogs(
                logs,
                'InFlightExitOmitted',
                { exitId: new BN(dummyExitId), token: ETH },
            );
        });

        it('should not withdraw fund for the non-piggybacked input', async () => {
            const dummyExitId = 666;
            const exit = await buildInFlightExitData();
            exit.isCanonical = false;

            // only piggyback on outputs
            exit.exitMap = 2 ** MAX_INPUT_NUM | 2 ** (MAX_INPUT_NUM + 1) | 2 ** (MAX_INPUT_NUM + 1);

            await this.exitGame.setInFlightExit(dummyExitId, exit);
            await this.exitGame.processExit(dummyExitId, VAULT_ID.ETH, ETH);

            const options = { fromBlock: 0, toBlock: 'latest' };
            const events = await this.ethVault.getPastEvents('EthWithdrawCalled', options);
            expect(events.length).to.equal(0);
        });

        it('should not withdraw fund for the non-piggybacked output', async () => {
            const dummyExitId = 666;
            const exit = await buildInFlightExitData();
            exit.isCanonical = true;
            exit.exitMap = 2 ** 0 | 2 ** 1 | 2 ** 2; // only piggyback on inputs

            await this.exitGame.setInFlightExit(dummyExitId, exit);
            await this.exitGame.processExit(dummyExitId, VAULT_ID.ETH, ETH);

            const options = { fromBlock: 0, toBlock: 'latest' };
            const events = await this.ethVault.getPastEvents('EthWithdrawCalled', options);
            expect(events.length).to.equal(0);
        });

        it('should not withdraw fund if the Output is already spent', async () => {
            const dummyExitId = 666;
            const exit = await buildInFlightExitData();
            exit.isCanonical = true;

            // piggybacks the first output but flag it as spent
            exit.exitMap = 2 ** MAX_INPUT_NUM;
            await this.exitGame.proxyFlagOutputSpent(TEST_OUTPUT_ID_FOR_OUTPUT_1);

            await this.exitGame.setInFlightExit(dummyExitId, exit);
            await this.exitGame.processExit(dummyExitId, VAULT_ID.ETH, ETH);

            const options = { fromBlock: 0, toBlock: 'latest' };
            const events = await this.ethVault.getPastEvents('EthWithdrawCalled', options);
            expect(events.length).to.equal(0);
        });

        describe('When bond return call failed', () => {
            beforeEach(async () => {
                this.dummyExitId = 666;
                this.attacker = await Attacker.new();

                this.preAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
            });

            describe('on start ife bond return', () => {
                beforeEach(async () => {
                    this.exit = await buildInFlightExitData(inputOwner1, outputOwner1, this.attacker.address);

                    await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);
                    const { receipt } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ETH, ETH);
                    this.receipt = receipt;
                });

                it('should not return bond', async () => {
                    const postAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                    expect(postAttackBalance).to.be.bignumber.equal(this.preAttackBalance);
                });

                it('should publish an event that bond return failed', async () => {
                    await expectEvent.inTransaction(
                        this.receipt.transactionHash,
                        PaymentProcessInFlightExit,
                        'InFlightBondReturnFailed',
                        {
                            receiver: this.attacker.address,
                            amount: new BN(this.startIFEBondSize),
                        },
                    );
                });
            });

            describe('on piggyback bond return', () => {
                beforeEach(async () => {
                    this.exit = await buildInFlightExitData(this.attacker.address, this.attacker.address);
                });

                const setExitAndStartProcessing = async (exitMap, isCanonical) => {
                    this.exit.exitMap = exitMap;
                    this.exit.isCanonical = isCanonical;
                    await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);
                    const { receipt } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ETH, ETH);
                    return receipt;
                };

                describe('when transaction is non-canonical', () => {
                    beforeEach(async () => {
                        this.receipt = await setExitAndStartProcessing(2 ** 0, false);
                    });

                    it('should not return piggyback bond', async () => {
                        const postAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                        // only start ife bond was returned
                        const expectedBalance = this.preAttackBalance.sub(new BN(this.startIFEBondSize));
                        expect(postAttackBalance).to.be.bignumber.equal(expectedBalance);
                    });

                    it('should publish an event that input bond return failed', async () => {
                        await expectEvent.inTransaction(
                            this.receipt.transactionHash,
                            PaymentProcessInFlightExit,
                            'InFlightBondReturnFailed',
                            {
                                receiver: this.attacker.address,
                                amount: new BN(this.piggybackBondSize),
                            },
                        );
                    });
                });

                describe('when transaction is canonical', () => {
                    beforeEach(async () => {
                        this.receipt = await setExitAndStartProcessing(2 ** MAX_INPUT_NUM, true);
                    });

                    it('should not return piggyback bond', async () => {
                        const postAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                        // only start ife bond was returned
                        const expectedBalance = this.preAttackBalance.sub(new BN(this.startIFEBondSize));
                        expect(postAttackBalance).to.be.bignumber.equal(expectedBalance);
                    });

                    it('should publish an event that input bond return failed', async () => {
                        await expectEvent.inTransaction(
                            this.receipt.transactionHash,
                            PaymentProcessInFlightExit,
                            'InFlightBondReturnFailed',
                            {
                                receiver: this.attacker.address,
                                amount: new BN(this.piggybackBondSize),
                            },
                        );
                    });
                });
            });
        });

        describe('When any in-flight exit is processed successfully', () => {
            beforeEach(async () => {
                this.ifeBondOwnerPreBalance = new BN(await web3.eth.getBalance(ifeBondOwner));

                this.dummyExitId = 666;
                this.exit = await buildInFlightExitData();

                // piggybacks the first input for ETH and third for ERC20
                // second input is left unpiggybacked
                const firstOutputIndexInExitMap = MAX_INPUT_NUM + 0;
                const thirdOutputIndexInExitMap = MAX_INPUT_NUM + 2;
                this.exit.exitMap = (2 ** firstOutputIndexInExitMap) | (2 ** thirdOutputIndexInExitMap);

                await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);
                await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ETH, ETH);
            });

            it('should transfer exit bond to the IFE bond owner if all piggybacked inputs/outputs are cleaned up', async () => {
                await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);

                const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                const expectedBalance = this.ifeBondOwnerPreBalance.add(this.startIFEBondSize);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should flag all inputs with the same token as spent no matter piggybacked or not', async () => {
                // piggybacked input
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_INPUT_1)).to.be.true;
                // unpiggybacked input
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_INPUT_2)).to.be.true;
            });

            it('should flag all piggybacked outputs with the same token as spent', async () => {
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_OUTPUT_1)).to.be.true;
            });

            it('should NOT flag non-piggybacked output with the same token as spent', async () => {
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_OUTPUT_2)).to.be.false;
            });

            it('should clean the piggyback flag of the inputs/outputs with same token', async () => {
                const exit = await this.exitGame.inFlightExits(this.dummyExitId);
                const thirdOutputIndexInExitMap = MAX_INPUT_NUM + 2;
                const exitMapWithErc20Outputs = 2 ** thirdOutputIndexInExitMap;
                expect(exit.exitMap).to.equal(exitMapWithErc20Outputs.toString());
            });

            // erc20 are not processed yet, thus not fully resolved.
            describe('When not all piggybacks are resolved', () => {
                it('should NOT transfer exit bond to the IFE bond owner', async () => {
                    // erc20 remained un-processed, thus should not return the bond yet
                    const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                    expect(postBalance).to.be.bignumber.equal(this.ifeBondOwnerPreBalance);
                });

                it('should NOT delete the exit from storage', async () => {
                    const exit = await this.exitGame.inFlightExits(this.dummyExitId);
                    expect(exit.exitStartTimestamp).to.not.equal('0');
                });
            });

            describe('When all piggybacks are resolved', () => {
                beforeEach(async () => {
                    await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                });

                it('should transfer exit bond to the IFE bond owner', async () => {
                    const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                    const expectedBalance = this.ifeBondOwnerPreBalance.add(this.startIFEBondSize);

                    expect(postBalance).to.be.bignumber.equal(expectedBalance);
                });

                it('should delete the exit from storage', async () => {
                    const exit = await this.exitGame.inFlightExits(this.dummyExitId);
                    expect(exit.exitStartTimestamp).to.equal('0');
                });
            });
        });

        describe('When the exit is non canonical, and inputs are piggybacked', () => {
            beforeEach(async () => {
                this.dummyExitId = 666;
                this.exit = await buildInFlightExitData();
                this.exit.isCanonical = false;

                // piggybacks all three inputs
                this.exit.exitMap = (2 ** 0) | (2 ** 1) | (2 ** 2);

                await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);

                this.inputOwner3PreBalance = new BN(await web3.eth.getBalance(inputOwner3));
            });

            it('should withdraw ETH from vault for the input', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ETH, ETH);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: inputOwner1,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: inputOwner2,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );
            });

            it('should withdraw ERC20 from vault for the input', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyErc20Vault,
                    'Erc20WithdrawCalled',
                    {
                        target: inputOwner3,
                        token: erc20,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );
            });

            it('should return piggyback bond to the input owner', async () => {
                await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                const postBalance = new BN(await web3.eth.getBalance(inputOwner3));
                const expectedBalance = this.inputOwner3PreBalance.add(this.piggybackBondSize);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should emit InFlightExitInputWithdrawn event', async () => {
                const { logs } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                const inputIndexForThirdInput = 2;
                await expectEvent.inLogs(
                    logs,
                    'InFlightExitInputWithdrawn',
                    { exitId: new BN(this.dummyExitId), inputIndex: new BN(inputIndexForThirdInput) },
                );
            });
        });

        describe('When the exit is canonical, and outputs are piggybacked', () => {
            beforeEach(async () => {
                this.dummyExitId = 666;
                this.exit = await buildInFlightExitData();
                this.exit.isCanonical = true;

                // piggybacks all three outputs
                this.exit.exitMap = (2 ** MAX_INPUT_NUM) | (2 ** (MAX_INPUT_NUM + 1)) | (2 ** (MAX_INPUT_NUM + 2));

                await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);

                this.outputOwner3PreBalance = new BN(await web3.eth.getBalance(outputOwner3));
            });

            it('should withdraw ETH from vault for the output', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ETH, ETH);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: outputOwner1,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: outputOwner2,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );
            });

            it('should withdraw ERC20 from vault for the output', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyErc20Vault,
                    'Erc20WithdrawCalled',
                    {
                        target: outputOwner3,
                        token: erc20,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );
            });

            it('should return piggyback bond to the output owner', async () => {
                await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                const postBalance = new BN(await web3.eth.getBalance(outputOwner3));
                const expectedBalance = this.outputOwner3PreBalance.add(this.piggybackBondSize);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should emit InFlightExitOutputWithdrawn event', async () => {
                const { logs } = await this.exitGame.processExit(this.dummyExitId, VAULT_ID.ERC20, erc20);
                const outputIndexForThirdOutput = 2;
                await expectEvent.inLogs(
                    logs,
                    'InFlightExitOutputWithdrawn',
                    { exitId: new BN(this.dummyExitId), outputIndex: new BN(outputIndexForThirdOutput) },
                );
            });
        });
    });
});
