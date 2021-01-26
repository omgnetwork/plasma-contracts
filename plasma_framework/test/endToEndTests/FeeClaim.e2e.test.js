const EthVault = artifacts.require('EthVault');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');
const PaymentStartStandardExit = artifacts.require('PaymentStartStandardExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');

const { constants, expectEvent } = require('openzeppelin-test-helpers');

const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

const {
    PaymentTransactionOutput,
    PaymentTransaction,
    FeeTransaction,
    FeeClaimOutput,
} = require('../helpers/transaction.js');
const { sign } = require('../helpers/sign.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const { MerkleTree } = require('../helpers/merkle.js');

/**
 * First three accounts are in the order of (deployer, maintainer, authority).
 * This is how migration scripts use the account.
 */
contract('PlasmaFramework - Fee Claim', ([_, _maintainer, authority, richFather, bob, carol]) => {
    const DEPOSIT_VALUE = 1000000;
    const ETH = constants.ZERO_ADDRESS;
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;
    const FEE_OUTPUT_TYPE = config.registerKeys.outputTypes.feeClaim;
    const FEE_AMOUNT = 1000;
    const MERKLE_TREE_DEPTH = 16;
    const PAYMENT_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    const operatorFeeAddressPrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10cb';
    let alice;
    let operatorFeeAddress;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });

        operatorFeeAddress = await web3.eth.personal.importRawKey(operatorFeeAddressPrivateKey, password);
        operatorFeeAddress = web3.utils.toChecksumAddress(operatorFeeAddress);
        web3.eth.personal.unlockAccount(operatorFeeAddress, password, 3600);
        web3.eth.sendTransaction({ to: operatorFeeAddress, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    describe('Given contracts deployed, ETH exitQueue added to the framework', () => {
        before(async () => {
            await setupAccount();

            this.framework = await PlasmaFramework.deployed();
            this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
            this.paymentExitGame = await PaymentExitGame.at(
                await this.framework.exitGames(config.registerKeys.txTypes.payment),
            );

            this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
        });

        describe('When Alice deposits ETH to the plasma', () => {
            let alicePlasmaBalance;
            let aliceDepositUtxoPos;

            before(async () => {
                const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
                aliceDepositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);

                const depositTx = Testlang.deposit(PAYMENT_OUTPUT_TYPE, DEPOSIT_VALUE, alice);
                alicePlasmaBalance = DEPOSIT_VALUE;

                return this.ethVault.deposit(depositTx, { from: alice, value: DEPOSIT_VALUE });
            });

            describe('When Alice transfers to Bob, fee is implicitly collected', () => {
                let aliceBalanceUtxoPosAfterTransferToBob;
                let aliceTransferToBobTxBytes;

                before(async () => {
                    const transferAmount = 1000;
                    alicePlasmaBalance -= transferAmount + FEE_AMOUNT;
                    const outputBob = new PaymentTransactionOutput(PAYMENT_OUTPUT_TYPE, transferAmount, bob, ETH);
                    const outputAlice = new PaymentTransactionOutput(
                        PAYMENT_OUTPUT_TYPE,
                        alicePlasmaBalance,
                        alice,
                        ETH,
                    );

                    const aliceBalanceOutputIndex = 1;
                    const blockNum = (await this.framework.nextChildBlock()).toNumber();
                    aliceBalanceUtxoPosAfterTransferToBob = buildUtxoPos(blockNum, 0, aliceBalanceOutputIndex);

                    const txObj = new PaymentTransaction(
                        PAYMENT_TX_TYPE,
                        [aliceDepositUtxoPos],
                        [outputBob, outputAlice],
                    );
                    aliceTransferToBobTxBytes = web3.utils.bytesToHex(txObj.rlpEncoded());
                });

                describe('And then operator mined the block with the first fee tx claiming the fee', () => {
                    let firstFeeTxBytes;
                    let firstFeeClaimUtxoPos;
                    let firstFeeTxMerkleProof;

                    before(async () => {
                        const nextBlockNum = (await this.framework.nextChildBlock()).toNumber();
                        const feeOutputs = [new FeeClaimOutput(FEE_OUTPUT_TYPE, FEE_AMOUNT, operatorFeeAddress, ETH)];

                        const nonce = web3.utils.sha3(
                            web3.eth.abi.encodeParameters(['uint256', 'address'], [nextBlockNum, ETH]),
                        );

                        const outputIndex = 0;
                        const feeTxIndex = 1;
                        firstFeeClaimUtxoPos = buildUtxoPos(nextBlockNum, feeTxIndex, outputIndex);

                        const firstFeeTx = new FeeTransaction(FEE_TX_TYPE, [], feeOutputs, nonce);
                        firstFeeTxBytes = web3.utils.bytesToHex(firstFeeTx.rlpEncoded());

                        const merkleTree = new MerkleTree(
                            [aliceTransferToBobTxBytes, firstFeeTxBytes],
                            MERKLE_TREE_DEPTH,
                        );
                        firstFeeTxMerkleProof = merkleTree.getInclusionProof(firstFeeTxBytes);

                        await this.framework.submitBlock(merkleTree.root, { from: authority });
                    });

                    describe('When Alice transfers to Carol, fee is implicitly collected', () => {
                        let aliceTransferToCarolTxBytes;

                        before(async () => {
                            const transferAmount = 1000;
                            alicePlasmaBalance -= transferAmount + FEE_AMOUNT;
                            const outputCarol = new PaymentTransactionOutput(
                                PAYMENT_OUTPUT_TYPE,
                                transferAmount,
                                carol,
                                ETH,
                            );
                            const outputAlice = new PaymentTransactionOutput(
                                PAYMENT_OUTPUT_TYPE,
                                alicePlasmaBalance,
                                alice,
                                ETH,
                            );

                            const txObj = new PaymentTransaction(
                                PAYMENT_TX_TYPE,
                                [aliceBalanceUtxoPosAfterTransferToBob],
                                [outputCarol, outputAlice],
                            );
                            aliceTransferToCarolTxBytes = web3.utils.bytesToHex(txObj.rlpEncoded());
                        });

                        describe('And then operator mined the block with the second fee tx claiming the fee', () => {
                            let secondFeeTxBytes;
                            let secondFeeClaimUtxoPos;
                            let secondFeeTxMerkleProof;

                            before(async () => {
                                const nextBlockNum = (await this.framework.nextChildBlock()).toNumber();
                                const feeOutputs = [
                                    new FeeClaimOutput(FEE_OUTPUT_TYPE, FEE_AMOUNT, operatorFeeAddress, ETH),
                                ];
                                const nonce = web3.utils.sha3(
                                    web3.eth.abi.encodeParameters(['uint256', 'address'], [nextBlockNum, ETH]),
                                );

                                const secondFeeTx = new FeeTransaction(FEE_TX_TYPE, [], feeOutputs, nonce);
                                secondFeeTxBytes = web3.utils.bytesToHex(secondFeeTx.rlpEncoded());

                                const outputIndex = 0;
                                const feeTxIndex = 1;
                                secondFeeClaimUtxoPos = buildUtxoPos(nextBlockNum, feeTxIndex, outputIndex);

                                const merkleTree = new MerkleTree(
                                    [aliceTransferToCarolTxBytes, secondFeeTxBytes],
                                    MERKLE_TREE_DEPTH,
                                );
                                secondFeeTxMerkleProof = merkleTree.getInclusionProof(secondFeeTxBytes);
                                await this.framework.submitBlock(merkleTree.root, { from: authority });
                            });

                            describe('And then the operator spends the 2 fee claim outputs in a payment transaction', () => {
                                let paymentTxObj;
                                let paymentTxBytes;
                                let paymentOutputUtxoPos;
                                let paymentTxMerkleProof;

                                before(async () => {
                                    const inputs = [firstFeeClaimUtxoPos, secondFeeClaimUtxoPos];
                                    const outputs = [
                                        new PaymentTransactionOutput(
                                            PAYMENT_OUTPUT_TYPE,
                                            FEE_AMOUNT * 2,
                                            operatorFeeAddress,
                                            ETH,
                                        ),
                                    ];
                                    paymentTxObj = new PaymentTransaction(PAYMENT_TX_TYPE, inputs, outputs);
                                    paymentTxBytes = web3.utils.bytesToHex(paymentTxObj.rlpEncoded());

                                    const nextBlockNum = (await this.framework.nextChildBlock()).toNumber();
                                    const outputIndex = 0;
                                    paymentOutputUtxoPos = buildUtxoPos(nextBlockNum, 0, outputIndex);

                                    const merkleTree = new MerkleTree([paymentTxBytes], MERKLE_TREE_DEPTH);
                                    paymentTxMerkleProof = merkleTree.getInclusionProof(paymentTxBytes);
                                    await this.framework.submitBlock(merkleTree.root, { from: authority });
                                });

                                it('should be able to standard exit the fee via payment transaction', async () => {
                                    const args = {
                                        utxoPos: paymentOutputUtxoPos,
                                        rlpOutputTx: paymentTxBytes,
                                        outputTxInclusionProof: paymentTxMerkleProof,
                                    };

                                    const bondSize = await this.paymentExitGame.startStandardExitBondSize();
                                    const { receipt } = await this.paymentExitGame.startStandardExit(args, {
                                        from: operatorFeeAddress,
                                        value: bondSize,
                                    });
                                    await expectEvent.inTransaction(
                                        receipt.transactionHash,
                                        PaymentStartStandardExit,
                                        'ExitStarted',
                                    );
                                });

                                it('should be able to in-flight exit the fee via Payment transaction', async () => {
                                    const txHash = hashTx(paymentTxObj, this.framework.address);
                                    const operatorSignature = sign(txHash, operatorFeeAddressPrivateKey);
                                    const args = {
                                        inFlightTx: paymentTxBytes,
                                        inputTxs: [firstFeeTxBytes, secondFeeTxBytes],
                                        inputUtxosPos: [firstFeeClaimUtxoPos, secondFeeClaimUtxoPos],
                                        inputTxsInclusionProofs: [firstFeeTxMerkleProof, secondFeeTxMerkleProof],
                                        inFlightTxWitnesses: [operatorSignature, operatorSignature],
                                    };

                                    const bondSize = await this.paymentExitGame.startIFEBondSize();
                                    const { receipt } = await this.paymentExitGame.startInFlightExit(args, {
                                        from: alice,
                                        value: bondSize,
                                    });
                                    await expectEvent.inTransaction(
                                        receipt.transactionHash,
                                        PaymentStartInFlightExit,
                                        'InFlightExitStarted',
                                    );
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
