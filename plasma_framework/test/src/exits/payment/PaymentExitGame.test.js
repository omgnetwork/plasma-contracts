const PaymentExitGame = artifacts.require('PaymentExitGame');
const PaymentOutputToPaymentTxCondition = artifacts.require('PaymentOutputToPaymentTxCondition');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PriorityQueue = artifacts.require('PriorityQueue');
const EthVault = artifacts.require('EthVault');
const EthDepositVerifier = artifacts.require('EthDepositVerifier');
const ExitId = artifacts.require('ExitIdWrapper');

const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../../../helpers/transaction.js');
const { addressToOutputGuard, computeDepositOutputId, spentOnGas } = require('../../../helpers/utils.js');
const { sign } = require('../../../helpers/sign.js');
const { hashTx } = require('../../../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../../../helpers/utxoPos.js');
const Testlang = require('../../../helpers/testlang.js');

contract('PaymentExitGame - End to End Tests', ([_, richFather, bob]) => {
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const STANDARD_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const DEPOSIT_VALUE = 1000000;
    const OUTPUT_TYPE_ZERO = 0;
    const EMPTY_BYTES = '0x';
    const PAYMENT_TX_TYPE = 1;
    const INITIAL_IMMUNE_VAULTS = 1;
    const INITIAL_IMMUNE_EXIT_GAMES = 1;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    before(async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });

        this.exitIdHelper = await ExitId.new();
    });

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.new(MIN_EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES);
        this.exitGame = await PaymentExitGame.new(this.framework.address);

        this.toPaymentCondition = await PaymentOutputToPaymentTxCondition.new(this.framework.address);
        await this.exitGame.registerSpendingCondition(
            OUTPUT_TYPE_ZERO, PAYMENT_TX_TYPE, this.toPaymentCondition.address,
        );

        this.ethVault = await EthVault.new(this.framework.address);
        const depositVerifier = await EthDepositVerifier.new();
        await this.ethVault.setDepositVerifier(depositVerifier.address);

        await this.framework.registerVault(1, this.ethVault.address);
        await this.framework.registerExitGame(PAYMENT_TX_TYPE, this.exitGame.address);
    };

    const aliceDeposits = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(DEPOSIT_VALUE, alice);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], 16);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        await this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
    };

    const aliceTransferToBob = async () => {
        const tranferTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
        this.transferUtxoPos = buildUtxoPos(tranferTxBlockNum, 0, 0);

        const output = new PaymentTransactionOutput(1000, addressToOutputGuard(bob), ETH);
        this.transferTxObject = new PaymentTransaction(1, [this.depositUtxoPos], [output]);
        this.transferTx = this.transferTxObject.rlpEncoded();
        this.merkleTreeForTransferTx = new MerkleTree([this.transferTx]);
        this.merkleProofForTransferTx = this.merkleTreeForTransferTx.getInclusionProof(this.transferTx);

        await this.framework.submitBlock(this.merkleTreeForTransferTx.root);
    };

    describe('Given contracts deployed, exit game and ETH vault registered', () => {
        beforeEach(setupContracts);

        describe('Given alice deposited', () => {
            beforeEach(aliceDeposits);

            describe('When alice starts standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.depositUtxoPos, this.depositTx, OUTPUT_TYPE_ZERO,
                        EMPTY_BYTES, this.merkleProofForDepositTx,
                        { from: alice, value: STANDARD_EXIT_BOND },
                    );
                });

                it('should save the StandardExit data when successfully done', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(true, this.depositTx, this.depositUtxoPos);
                    const standardExitData = await this.exitGame.exits(exitId);

                    const outputIndexForDeposit = 0;
                    const outputId = computeDepositOutputId(
                        this.depositTx, outputIndexForDeposit, this.depositUtxoPos,
                    );
                    const expectedOutputRelatedDataHash = web3.utils.soliditySha3(
                        { t: 'uint256', v: this.depositUtxoPos }, { t: 'bytes32', v: outputId },
                        { t: 'uint256', v: OUTPUT_TYPE_ZERO }, { t: 'bytes32', v: addressToOutputGuard(alice) },
                    );

                    expect(standardExitData.exitable).to.be.true;
                    expect(standardExitData.outputRelatedDataHash).to.equal(expectedOutputRelatedDataHash);
                    expect(standardExitData.token).to.equal(ETH);
                    expect(standardExitData.exitTarget).to.equal(alice);
                    expect(standardExitData.amount).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                });

                it('should put the exit data into the queue of framework', async () => {
                    const priorityQueueAddress = await this.framework.exitsQueues(ETH);
                    const priorityQueue = await PriorityQueue.at(priorityQueueAddress);
                    const uniquePriority = await priorityQueue.getMin();

                    // right most 64 bits are nonce for priority queue
                    expect(uniquePriority.shrn(64)).to.be.bignumber.equal(new BN(this.depositUtxoPos));
                });
            });
        });

        describe('Given alice deposited and transferred to bob', () => {
            beforeEach(async () => {
                await aliceDeposits();
                await aliceTransferToBob();
            });

            describe('When bob tries to start the standard exit on the transfered tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.transferUtxoPos, this.transferTx, OUTPUT_TYPE_ZERO,
                        EMPTY_BYTES, this.merkleProofForTransferTx,
                        { from: bob, value: STANDARD_EXIT_BOND },
                    );
                });

                it('should start successully', async () => {
                    const exitId = await this.exitIdHelper.getStandardExitId(
                        false, this.transferTx, this.transferUtxoPos,
                    );
                    const standardExitData = await this.exitGame.exits(exitId);
                    expect(standardExitData.exitable).to.be.true;
                });
            });
        });

        describe('Given alice deposited and transfered to bob', () => {
            beforeEach(async () => {
                await aliceDeposits();
                await aliceTransferToBob();
            });

            describe('When alice tries to start the standard exit on the deposit tx', () => {
                beforeEach(async () => {
                    await this.exitGame.startStandardExit(
                        this.depositUtxoPos, this.depositTx, OUTPUT_TYPE_ZERO,
                        EMPTY_BYTES, this.merkleProofForDepositTx,
                        { from: alice, value: STANDARD_EXIT_BOND },
                    );
                    this.exitId = await this.exitIdHelper.getStandardExitId(
                        true, this.depositTx, this.depositUtxoPos,
                    );
                });

                it('should still be able to start standard exit even already spent', async () => {
                    const standardExitData = await this.exitGame.exits(this.exitId);
                    expect(standardExitData.exitable).to.be.true;
                });

                describe('Then bob can challenge the standard exit spent', async () => {
                    beforeEach(async () => {
                        const txHash = hashTx(this.transferTxObject, this.framework.address);
                        const signature = sign(txHash, alicePrivateKey);

                        const input = {
                            exitId: this.exitId.toString(10),
                            outputType: OUTPUT_TYPE_ZERO,
                            outputUtxoPos: this.depositUtxoPos,
                            outputId: computeDepositOutputId(this.depositTx, 0, this.depositUtxoPos),
                            outputGuard: addressToOutputGuard(alice),
                            challengeTxType: PAYMENT_TX_TYPE,
                            challengeTx: this.transferTx,
                            inputIndex: 0,
                            witness: signature,
                        };

                        this.bobBalanceBeforeChallenge = new BN(await web3.eth.getBalance(bob));
                        const { logs, receipt } = await this.exitGame.challengeStandardExit(
                            input, { from: bob },
                        );
                        this.challengeTxLogs = logs;
                        this.challengeTxReciept = receipt;
                    });

                    it('should challenge it successfully', async () => {
                        expectEvent.inLogs(
                            this.challengeTxLogs,
                            'ExitChallenged',
                            { utxoPos: new BN(this.depositUtxoPos) },
                        );
                    });

                    it('should transfer the bond to bob', async () => {
                        const actualBobBalanceAfterChallenge = new BN(await web3.eth.getBalance(bob));
                        const expectedBobBalanceAfterChallenge = this.bobBalanceBeforeChallenge
                            .add(new BN(STANDARD_EXIT_BOND))
                            .sub(await spentOnGas(this.challengeTxReciept));

                        expect(actualBobBalanceAfterChallenge).to.be.bignumber.equal(expectedBobBalanceAfterChallenge);
                    });
                });
            });
        });
    });
});
