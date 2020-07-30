const ExitIdWrapper = artifacts.require('ExitIdWrapper');
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
const StateTransitionVerifierMock = artifacts.require('StateTransitionVerifierMock');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { buildUtxoPos } = require('../../../../helpers/positions.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../../helpers/transaction.js');
const {
    PROTOCOL, TX_TYPE, VAULT_ID, SAFE_GAS_STIPEND,
} = require('../../../../helpers/constants.js');

contract('PaymentDeleteInFlightExit', ([_, bondOwner, inputOwner, outputOwner]) => {
    const ETH = constants.ZERO_ADDRESS;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const BLOCK_NUMBER = 5000;
    const OUTPUT_TYPE = {
        ONE: 1, TWO: 2,
    };
    const PAYMENT_TX_TYPE = 1;

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

    before('deploy helper contracts', async () => {
        this.exitIdHelper = await ExitIdWrapper.new();
        this.stateTransitionVerifier = await StateTransitionVerifierMock.new();
        await this.stateTransitionVerifier.mockResult(true);
    });

    beforeEach(async () => {
        this.framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );

        const ethVault = await SpyEthVault.new(this.framework.address);
        const erc20Vault = await SpyErc20Vault.new(this.framework.address);

        await this.framework.registerVault(VAULT_ID.ETH, ethVault.address);
        await this.framework.registerVault(VAULT_ID.ERC20, erc20Vault.address);

        const spendingConditionRegistry = await SpendingConditionRegistry.new();

        const exitArgs = [
            this.framework.address,
            VAULT_ID.ETH,
            VAULT_ID.ERC20,
            spendingConditionRegistry.address,
            this.stateTransitionVerifier.address,
            PAYMENT_TX_TYPE,
            SAFE_GAS_STIPEND,
        ];
        this.exitGame = await PaymentInFlightExitRouter.new(exitArgs);
        await this.exitGame.init();
        await this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);

        this.startIFEBondSize = await this.exitGame.startIFEBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();
    });

    describe('deleteNonPiggybackedInFlightExit', () => {
        /**
         * This setup IFE data with 1 input and 1 outputs with different owners.
         * The IFE data is initiated without any input/output piggybacked
         * */
        const buildIFE = async () => {
            const outputAmount = 499;
            const output1 = new PaymentTransactionOutput(OUTPUT_TYPE.ONE, outputAmount, outputOwner, ETH);

            const inFlightTx = new PaymentTransaction(1, [buildUtxoPos(BLOCK_NUMBER, 0, 0)], [output1]);
            const rlpInFlighTxBytes = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

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
                oldestCompetitorPosition: 0,
                inputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: inputOwner,
                    token: ETH,
                    amount: 999,
                    piggybackBondSize: 0,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
                outputs: [{
                    outputId: web3.utils.sha3('dummy output id'),
                    exitTarget: constants.ZERO_ADDRESS, // would not be set during start IFE
                    token: ETH,
                    amount: outputAmount,
                    piggybackBondSize: 0,
                }, emptyWithdrawData, emptyWithdrawData, emptyWithdrawData],
                bondSize: this.startIFEBondSize.toString(),
            };

            const exitId = await this.exitIdHelper.getInFlightExitId(rlpInFlighTxBytes);

            return {
                exitId,
                inFlightExitData,
            };
        };

        it('should fail when the exit does not exits', async () => {
            const nonExistingExitId = 123;
            await expectRevert(
                this.exitGame.deleteNonPiggybackedInFlightExit(nonExistingExitId),
                'In-flight exit does not exist',
            );
        });

        it('should fail when the exit is still in first phase', async () => {
            const { exitId, inFlightExitData } = await buildIFE();
            await this.exitGame.setInFlightExit(exitId, inFlightExitData);

            await expectRevert(
                this.exitGame.deleteNonPiggybackedInFlightExit(exitId),
                'Cannot delete in-flight exit still in first phase',
            );
        });

        it('should fail when input of the exit is piggybacked', async () => {
            const { exitId, inFlightExitData } = await buildIFE();
            await this.exitGame.setInFlightExit(exitId, inFlightExitData);
            await this.exitGame.setInFlightExitInputPiggybacked(exitId, 0);

            await time.increase(MIN_EXIT_PERIOD / 2 + 1);

            await expectRevert(
                this.exitGame.deleteNonPiggybackedInFlightExit(exitId),
                'The in-flight exit is already piggybacked',
            );
        });

        it('should fail when output of the exit is piggybacked', async () => {
            const { exitId, inFlightExitData } = await buildIFE();
            await this.exitGame.setInFlightExit(exitId, inFlightExitData);
            await this.exitGame.setInFlightExitOutputPiggybacked(exitId, 0);

            await time.increase(MIN_EXIT_PERIOD / 2 + 1);

            await expectRevert(
                this.exitGame.deleteNonPiggybackedInFlightExit(exitId),
                'The in-flight exit is already piggybacked',
            );
        });

        it('should fail when failed to transfer bond', async () => {
            const { exitId, inFlightExitData } = await buildIFE();
            await this.exitGame.setInFlightExit(exitId, inFlightExitData);

            await time.increase(MIN_EXIT_PERIOD / 2 + 1);

            // This is tested by the mock exit game contract has no balance by default
            // So would fail to transfer the bond
            await expectRevert(
                this.exitGame.deleteNonPiggybackedInFlightExit(exitId),
                'SafeEthTransfer: failed to transfer ETH',
            );
        });

        describe('when the delete succeeds', () => {
            let bondOwnerPreBalance;
            let exitId;
            let deleteTx;

            beforeEach(async () => {
                bondOwnerPreBalance = new BN(await web3.eth.getBalance(bondOwner));
                await this.exitGame.depositFundForTest({ value: this.startIFEBondSize });

                let inFlightExitData;
                ({ exitId, inFlightExitData } = await buildIFE());

                await this.exitGame.setInFlightExit(exitId, inFlightExitData);

                await time.increase(MIN_EXIT_PERIOD / 2 + 1);

                deleteTx = await this.exitGame.deleteNonPiggybackedInFlightExit(exitId);
            });

            it('should send the IFE bond to the bond owner', async () => {
                const bondOwnerPostBalance = new BN(await web3.eth.getBalance(bondOwner));

                const expectedPostBalance = bondOwnerPreBalance.add(new BN(this.startIFEBondSize));

                expect(bondOwnerPostBalance).to.be.bignumber.equal(expectedPostBalance);
            });

            it('should delete the in-flight exit data', async () => {
                const exits = await this.exitGame.inFlightExits([exitId]);
                expect(exits[0].exitStartTimestamp).to.equal('0');
            });

            it('should emit InFlightExitDeleted event', async () => {
                await expectEvent.inLogs(
                    deleteTx.logs,
                    'InFlightExitDeleted',
                    { exitId: new BN(exitId) },
                );
            });
        });
    });
});
