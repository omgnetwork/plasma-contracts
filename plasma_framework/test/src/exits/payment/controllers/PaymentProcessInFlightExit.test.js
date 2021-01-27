/* eslint no-bitwise: ["error", { "allow": ["|"] }] */

const Attacker = artifacts.require('FallbackFunctionFailAttacker');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentChallengeIFEInputSpent = artifacts.require('PaymentChallengeIFEInputSpent');
const PaymentChallengeIFEOutputSpent = artifacts.require('PaymentChallengeIFEOutputSpent');
const PaymentDeleteInFlightExit = artifacts.require('PaymentDeleteInFlightExit');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const SpendingConditionRegistry = artifacts.require('SpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');

const {
    BN, constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const {
    TX_TYPE, PROTOCOL, VAULT_ID, SAFE_GAS_STIPEND, EMPTY_BYTES_32,
} = require('../../../../helpers/constants.js');
const { buildUtxoPos } = require('../../../../helpers/positions.js');

contract('PaymentProcessInFlightExit', ([_, ifeBondOwner, inputOwner1, inputOwner2, inputOwner3, outputOwner1, outputOwner2, outputOwner3, otherAddress]) => {
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
    const DUMMY_EXIT_ID = 666;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;
    let erc20;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const challengeIFEInputSpent = await PaymentChallengeIFEInputSpent.new();
        const challengeIFEOutputSpent = await PaymentChallengeIFEOutputSpent.new();
        const deleteInFlightEixt = await PaymentDeleteInFlightExit.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEInputSpent', challengeIFEInputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFEOutputSpent', challengeIFEOutputSpent.address);
        await PaymentInFlightExitRouter.link('PaymentDeleteInFlightExit', deleteInFlightEixt.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('deploy dummy and helper contracts', async () => {
        erc20 = (await ERC20Mintable.new()).address;

        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
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
        bountySize = this.processExitBountySize.toString(),
    ) => {
        const emptyWithdrawData = {
            outputId: EMPTY_BYTES_32,
            exitTarget: constants.ZERO_ADDRESS,
            token: constants.ZERO_ADDRESS,
            amount: 0,
            piggybackBondSize: 0,
            bountySize: 0,
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
                bountySize,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_INPUT_2,
                exitTarget: inputOwner2,
                token: ETH,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
                bountySize,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_INPUT_3,
                exitTarget: inputOwner3,
                token: erc20,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
                bountySize,
            }, emptyWithdrawData],
            outputs: [{
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_1,
                exitTarget: exitTargetOutput1,
                token: ETH,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
                bountySize,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_2,
                exitTarget: outputOwner2,
                token: ETH,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
                bountySize,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_3,
                exitTarget: outputOwner3,
                token: erc20,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: this.piggybackBondSize.toString(),
                bountySize,
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

            const spendingConditionRegistry = await SpendingConditionRegistry.new();

            const exitGameArgs = [
                this.framework.address,
                VAULT_ID.ETH,
                VAULT_ID.ERC20,
                spendingConditionRegistry.address,
                this.stateTransitionVerifier.address,
                TX_TYPE.PAYMENT,
                SAFE_GAS_STIPEND,
            ];
            this.exitGame = await PaymentInFlightExitRouter.new();
            await this.exitGame.bootInternal(exitGameArgs);
            this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

            this.startIFEBondSize = await this.exitGame.startIFEBondSize();

            // ensure the piggyback band is slightly higher than the bounty to verify the failed bond return tests
            const originalPiggybackBond = await this.exitGame.piggybackBondSize();
            this.piggybackBondSize = originalPiggybackBond.addn(100);

            this.processExitBountySize = await this.exitGame.processInFlightExitBountySize();
            this.piggybackBondReturnValue = this.piggybackBondSize.sub(this.processExitBountySize);
            const maxNeededBond = this.startIFEBondSize.add(this.piggybackBondSize).muln(4);
            const totalAmount = maxNeededBond.add(this.processExitBountySize).muln(2);
            await this.exitGame.depositFundForTest({ value: totalAmount.toString() });
        });

        it('should omit the exit if the exit does not exist', async () => {
            const nonExistingExitId = 666;

            const { logs } = await this.exitGame.processExit(nonExistingExitId, VAULT_ID.ETH, ETH, otherAddress);
            await expectEvent.inLogs(
                logs,
                'InFlightExitOmitted',
                { exitId: new BN(nonExistingExitId), token: ETH },
            );
        });

        describe('When bond return call failed', () => {
            beforeEach(async () => {
                this.attacker = await Attacker.new();

                this.preAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
            });

            describe('on start ife bond return', () => {
                beforeEach(async () => {
                    this.exit = await buildInFlightExitData(inputOwner1, outputOwner1, this.attacker.address);

                    await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.exit);
                    const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
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
                    await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.exit);
                    const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                    return receipt;
                };

                describe('when transaction is non-canonical', () => {
                    beforeEach(async () => {
                        this.receipt = await setExitAndStartProcessing(2 ** 0, false);
                    });

                    it('should not return piggyback bond', async () => {
                        const postAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                        // only start ife bond and exit bounty was returned
                        const expectedBalance = this.preAttackBalance
                            .sub(new BN(this.startIFEBondSize))
                            .sub(new BN(this.processExitBountySize));
                        expect(postAttackBalance).to.be.bignumber.equal(expectedBalance);
                    });

                    it('should publish an event that input bond return failed', async () => {
                        await expectEvent.inTransaction(
                            this.receipt.transactionHash,
                            PaymentProcessInFlightExit,
                            'InFlightBondReturnFailed',
                            {
                                receiver: this.attacker.address,
                                amount: new BN(this.piggybackBondReturnValue),
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
                        // only start ife bond and exit bounty was returned
                        const expectedBalance = this.preAttackBalance
                            .sub(new BN(this.startIFEBondSize))
                            .sub(new BN(this.processExitBountySize));
                        expect(postAttackBalance).to.be.bignumber.equal(expectedBalance);
                    });

                    it('should publish an event that input bond return failed', async () => {
                        await expectEvent.inTransaction(
                            this.receipt.transactionHash,
                            PaymentProcessInFlightExit,
                            'InFlightBondReturnFailed',
                            {
                                receiver: this.attacker.address,
                                amount: new BN(this.piggybackBondReturnValue),
                            },
                        );
                    });
                });
            });
        });

        describe('When bounty award call failed', () => {
            beforeEach(async () => {
                this.attacker = await Attacker.new();

                this.preAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
            });
            describe('on awarding exit bounty', () => {
                beforeEach(async () => {
                    this.exit = await buildInFlightExitData();
                });

                const setExitAndStartProcessing = async (exitMap, isCanonical) => {
                    this.exit.exitMap = exitMap;
                    this.exit.isCanonical = isCanonical;
                    await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.exit);
                    const { receipt } = await this.exitGame.processExit(
                        DUMMY_EXIT_ID,
                        VAULT_ID.ETH,
                        ETH,
                        this.attacker.address,
                    );
                    return receipt;
                };

                describe('when transaction is non-canonical', () => {
                    beforeEach(async () => {
                        this.receipt = await setExitAndStartProcessing(2 ** 0, false);
                    });

                    it('should not return exit bounty', async () => {
                        const postAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                        // only start ife bond and piggyback bond was returned
                        const expectedBalance = this.preAttackBalance
                            .sub(new BN(this.startIFEBondSize))
                            .sub(new BN(this.piggybackBondReturnValue));
                        expect(postAttackBalance).to.be.bignumber.equal(expectedBalance);
                    });

                    it('should publish an event that bounty award failed', async () => {
                        await expectEvent.inTransaction(
                            this.receipt.transactionHash,
                            PaymentProcessInFlightExit,
                            'InFlightBountyReturnFailed',
                            {
                                receiver: this.attacker.address,
                                amount: new BN(this.processExitBountySize),
                            },
                        );
                    });
                });

                describe('when transaction is canonical', () => {
                    beforeEach(async () => {
                        this.receipt = await setExitAndStartProcessing(2 ** MAX_INPUT_NUM, true);
                    });

                    it('should not return exit bounty', async () => {
                        const postAttackBalance = new BN(await web3.eth.getBalance(this.exitGame.address));
                        // only start ife bond and piggyback bond was returned
                        const expectedBalance = this.preAttackBalance
                            .sub(new BN(this.startIFEBondSize))
                            .sub(new BN(this.piggybackBondReturnValue));
                        expect(postAttackBalance).to.be.bignumber.equal(expectedBalance);
                    });

                    it('should publish an event that bounty award failed', async () => {
                        await expectEvent.inTransaction(
                            this.receipt.transactionHash,
                            PaymentProcessInFlightExit,
                            'InFlightBountyReturnFailed',
                            {
                                receiver: this.attacker.address,
                                amount: new BN(this.processExitBountySize),
                            },
                        );
                    });
                });
            });
        });

        describe('When any in-flight exit is processed successfully', () => {
            beforeEach(async () => {
                this.ifeBondOwnerPreBalance = new BN(await web3.eth.getBalance(ifeBondOwner));

                this.exit = await buildInFlightExitData();
                await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.exit);

                // piggybacks the first input for ETH
                // piggybacks the first output for ETH and third for ERC20
                // second input/output is left non-piggybacked
                await this.exitGame.setInFlightExitInputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 2);

                this.preBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
            });

            it('should transfer exit bounty to the process exit initiator of all piggybacked inputs/outputs that are cleaned up', async () => {
                const postBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                const expectedBalance = this.preBalanceOtherAddress
                    .add(this.processExitBountySize)
                    .add(this.processExitBountySize);

                expect(postBalanceOtherAddress).to.be.bignumber.equal(expectedBalance);
            });

            it('should transfer exit bond to the IFE bond owner if all piggybacked inputs/outputs are cleaned up', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);

                const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                const expectedBalance = this.ifeBondOwnerPreBalance.add(this.startIFEBondSize);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should only clean the piggyback flag of the inputs/outputs with same token', async () => {
                const exits = await this.exitGame.inFlightExits([DUMMY_EXIT_ID]);
                const thirdOutputIndexInExitMap = MAX_INPUT_NUM + 2;
                const exitMapWithErc20Outputs = 2 ** thirdOutputIndexInExitMap;
                expect(exits[0].exitMap).to.equal(exitMapWithErc20Outputs.toString());
            });

            // erc20 are not processed yet, thus not fully resolved.
            describe('When not all piggybacks are resolved', () => {
                it('should NOT transfer exit bond to the IFE bond owner', async () => {
                    // erc20 remained un-processed, thus should not return the bond yet
                    const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                    expect(postBalance).to.be.bignumber.equal(this.ifeBondOwnerPreBalance);
                });

                it('should NOT delete the exit from storage', async () => {
                    const exits = await this.exitGame.inFlightExits([DUMMY_EXIT_ID]);
                    expect(exits[0].exitStartTimestamp).to.not.equal('0');
                });
            });

            describe('When all piggybacks are resolved', () => {
                beforeEach(async () => {
                    const { logs } = await this.exitGame.processExit(
                        DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress,
                    );
                    this.processedLogs = logs;
                });

                it('should emit an event that exit is finalized', async () => {
                    await expectEvent.inLogs(
                        this.processedLogs,
                        'InFlightExitFinalized',
                        { exitId: new BN(DUMMY_EXIT_ID) },
                    );
                });

                it('should transfer exit bond to the IFE bond owner', async () => {
                    const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                    const expectedBalance = this.ifeBondOwnerPreBalance.add(this.startIFEBondSize);

                    expect(postBalance).to.be.bignumber.equal(expectedBalance);
                });

                it('should delete the exit from storage', async () => {
                    const exits = await this.exitGame.inFlightExits([DUMMY_EXIT_ID]);
                    expect(exits[0].exitStartTimestamp).to.equal('0');
                });
            });
        });

        describe('When any input is spent, given the challenge game result is canonical', () => {
            beforeEach(async () => {
                const exit = await buildInFlightExitData();
                exit.isCanonical = true;
                await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, exit);

                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitInputPiggybacked(DUMMY_EXIT_ID, 1);
            });

            it('should withdraw output if there are no inputs spent by other exit', async () => {
                await this.exitGame.proxyFlagOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_1, DUMMY_EXIT_ID);
                const { logs } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                await expectEvent.inLogs(
                    logs,
                    'InFlightExitOutputWithdrawn',
                    { exitId: new BN(DUMMY_EXIT_ID), outputIndex: new BN(0) },
                );
            });

            it('should be treated as non-canonical when there is an input spent by other exit', async () => {
                const otherExitId = DUMMY_EXIT_ID + 1;
                await this.exitGame.proxyFlagOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_1, otherExitId);
                const { logs } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                const inputIndexForInput2 = 1;
                await expectEvent.inLogs(
                    logs,
                    'InFlightExitInputWithdrawn',
                    { exitId: new BN(DUMMY_EXIT_ID), inputIndex: new BN(inputIndexForInput2) },
                );
            });
        });

        describe('When the Piggyback Bond size is equal to the Exit Bounty', () => {
            beforeEach(async () => {
                this.inFlightExitData2 = await buildInFlightExitData(
                    inputOwner1,
                    outputOwner1,
                    ifeBondOwner,
                    this.piggybackBondSize.toString(),
                );
                this.inFlightExitData2.isCanonical = true;
                await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.inFlightExitData2);

                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 0);
            });

            it('should not attempt returning piggyback bond', async () => {
                const preBalance = new BN(await web3.eth.getBalance(outputOwner1));
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                const postBalance = new BN(await web3.eth.getBalance(outputOwner1));

                expect(postBalance).to.be.bignumber.equal(preBalance);
            });

            it('should however return the complete piggyback bond as the exit bounty', async () => {
                const preBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                const postBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                const expectedBalance = preBalanceOtherAddress
                    .add(this.piggybackBondSize);

                expect(postBalanceOtherAddress).to.be.bignumber.equal(expectedBalance);
            });
        });

        describe('When the exit is non canonical, and some inputs/outputs are piggybacked', () => {
            beforeEach(async () => {
                this.exit = await buildInFlightExitData();
                this.exit.isCanonical = false;

                await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.exit);

                // piggybacks the first input for ETH and third for ERC20
                // piggybacks the first output for ETH and third for ERC20
                // second input/output is left non-piggybacked
                await this.exitGame.setInFlightExitInputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitInputPiggybacked(DUMMY_EXIT_ID, 2);
                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 2);

                this.inputOwner3PreBalance = new BN(await web3.eth.getBalance(inputOwner3));
                this.outputOwner3PreBalance = new BN(await web3.eth.getBalance(outputOwner3));
            });

            it('should withdraw ETH from vault for the piggybacked input', async () => {
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: inputOwner1,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );
            });

            it('should NOT withdraw fund from vault for the piggybacked but already spent input', async () => {
                await this.exitGame.proxyFlagOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_1, DUMMY_EXIT_ID);
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                let didNotCallEthWithdraw = false;
                try {
                    await expectEvent.inTransaction(
                        receipt.transactionHash,
                        SpyEthVault,
                        'EthWithdrawCalled',
                        {
                            target: inputOwner1,
                            amount: new BN(TEST_INPUT_AMOUNT),
                        },
                    );
                } catch (e) {
                    didNotCallEthWithdraw = true;
                }

                expect(didNotCallEthWithdraw).to.be.true;
            });

            it('should NOT withdraw fund from vault for the non piggybacked input', async () => {
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                let didNotCallEthWithdraw = false;
                try {
                    await expectEvent.inTransaction(
                        receipt.transactionHash,
                        SpyEthVault,
                        'EthWithdrawCalled',
                        {
                            target: inputOwner2,
                            amount: new BN(TEST_INPUT_AMOUNT),
                        },
                    );
                } catch (e) {
                    didNotCallEthWithdraw = true;
                }

                expect(didNotCallEthWithdraw).to.be.true;
            });

            it('should withdraw ERC20 from vault for the piggybacked input', async () => {
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
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

            it('should return remaining piggyback bond to the input owner', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const postBalance = new BN(await web3.eth.getBalance(inputOwner3));
                const expectedBalance = this.inputOwner3PreBalance.add(this.piggybackBondReturnValue);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should return remaining piggyback bond to the output owner', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const postBalance = new BN(await web3.eth.getBalance(outputOwner3));
                const expectedBalance = this.outputOwner3PreBalance.add(this.piggybackBondReturnValue);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should return bounty to the process exit initiator for both input and output', async () => {
                const preBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const postBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                const expectedBalance = preBalanceOtherAddress
                    .add(this.processExitBountySize)
                    .add(this.processExitBountySize);

                expect(postBalanceOtherAddress).to.be.bignumber.equal(expectedBalance);
            });

            it('should only flag piggybacked inputs with the same token as spent', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                // piggybacked input
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_1)).to.be.true;
                // non-piggybacked input
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_2)).to.be.false;
                // piggybacked input but different token
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_3)).to.be.false;
            });

            it('should NOT flag output as spent', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);

                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_1)).to.be.false;
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_2)).to.be.false;
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_3)).to.be.false;
            });

            it('should emit InFlightExitInputWithdrawn event', async () => {
                const { logs } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const inputIndexForThirdInput = 2;
                await expectEvent.inLogs(
                    logs,
                    'InFlightExitInputWithdrawn',
                    { exitId: new BN(DUMMY_EXIT_ID), inputIndex: new BN(inputIndexForThirdInput) },
                );
            });
        });

        describe('When the exit is canonical, and some inputs/outputs are piggybacked', () => {
            beforeEach(async () => {
                this.exit = await buildInFlightExitData();
                this.exit.isCanonical = true;

                await this.exitGame.setInFlightExit(DUMMY_EXIT_ID, this.exit);

                // piggybacks the first input for ETH and third for ERC20
                // piggybacks the first output for ETH and third for ERC20
                // second input/output is left non-piggybacked
                await this.exitGame.setInFlightExitInputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitInputPiggybacked(DUMMY_EXIT_ID, 2);
                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 0);
                await this.exitGame.setInFlightExitOutputPiggybacked(DUMMY_EXIT_ID, 2);

                this.inputOwner3PreBalance = new BN(await web3.eth.getBalance(inputOwner3));
                this.outputOwner3PreBalance = new BN(await web3.eth.getBalance(outputOwner3));
            });

            it('should withdraw ETH from vault for the piggybacked output', async () => {
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: outputOwner1,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );
            });

            it('should NOT withdraw from fund vault for the piggybacked but already spent output', async () => {
                await this.exitGame.proxyFlagOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_1, DUMMY_EXIT_ID);
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                let didNotCallEthWithdraw = false;
                try {
                    await expectEvent.inTransaction(
                        receipt.transactionHash,
                        SpyEthVault,
                        'EthWithdrawCalled',
                        {
                            target: outputOwner1,
                            amount: new BN(TEST_OUTPUT_AMOUNT),
                        },
                    );
                } catch (e) {
                    didNotCallEthWithdraw = true;
                }

                expect(didNotCallEthWithdraw).to.be.true;
            });

            it('should NOT withdraw from fund vault for the non piggybacked output', async () => {
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                let didNotCallEthWithdraw = false;
                try {
                    await expectEvent.inTransaction(
                        receipt.transactionHash,
                        SpyEthVault,
                        'EthWithdrawCalled',
                        {
                            target: outputOwner2, // non piggybacked output's owner
                            amount: new BN(TEST_OUTPUT_AMOUNT),
                        },
                    );
                } catch (e) {
                    didNotCallEthWithdraw = true;
                }

                expect(didNotCallEthWithdraw).to.be.true;
            });

            it('should withdraw ERC20 from vault for the piggybacked output', async () => {
                const { receipt } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
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

            it('should return remaining piggyback bond to the output owner', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const postBalance = new BN(await web3.eth.getBalance(outputOwner3));
                const expectedBalance = this.outputOwner3PreBalance.add(this.piggybackBondReturnValue);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should return remaining piggyback bond to the input owner', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const postBalance = new BN(await web3.eth.getBalance(inputOwner3));
                const expectedBalance = this.inputOwner3PreBalance.add(this.piggybackBondReturnValue);

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should return bounty to the process exit initiator for both input and output', async () => {
                const preBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const postBalanceOtherAddress = new BN(await web3.eth.getBalance(otherAddress));
                const expectedBalance = preBalanceOtherAddress
                    .add(this.processExitBountySize)
                    .add(this.processExitBountySize);

                expect(postBalanceOtherAddress).to.be.bignumber.equal(expectedBalance);
            });

            it('should flag ALL inputs as spent', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);
                // same token, both piggybacked and non-piggybacked cases
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_1)).to.be.true;
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_2)).to.be.true;
                // different token
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_INPUT_3)).to.be.true;
            });

            it('should only flag piggybacked output with the same token as spent', async () => {
                await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ETH, ETH, otherAddress);

                // piggybacked output of same token
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_1)).to.be.true;
                // non piggybacked output of same token
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_2)).to.be.false;
                // different token
                expect(await this.framework.isOutputFinalized(TEST_OUTPUT_ID_FOR_OUTPUT_3)).to.be.false;
            });

            it('should emit InFlightExitOutputWithdrawn event', async () => {
                const { logs } = await this.exitGame.processExit(DUMMY_EXIT_ID, VAULT_ID.ERC20, erc20, otherAddress);
                const outputIndexForThirdOutput = 2;
                await expectEvent.inLogs(
                    logs,
                    'InFlightExitOutputWithdrawn',
                    { exitId: new BN(DUMMY_EXIT_ID), outputIndex: new BN(outputIndexForThirdOutput) },
                );
            });
        });
    });
});
