const EthVault = artifacts.require('EthVault');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const {
    constants, expectEvent,
} = require('openzeppelin-test-helpers');

const config = require('../../config.js');

const {
    PaymentTransactionOutput, PaymentTransaction, FeeTransaction,
    FeeBlockNumOutput, FeeClaimOutput,
} = require('../helpers/transaction.js');
const { sign } = require('../helpers/sign.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const { MerkleTree } = require('../helpers/merkle.js');

/**
 * First three accounts are in the order of (deployer, maintainer, authority).
 * This is how migration scripts use the account.
 */
contract('PlasmaFramework - Fee Claim', ([_, _maintainer, authority, richFather]) => {
    const MERKLE_TREE_DEPTH = 16;
    const ETH = constants.ZERO_ADDRESS;
    const PAYMENT_OUTPUT_TYPE = config.registerKeys.outputTypes.payment;
    const PAYMENT_TX_TYPE = config.registerKeys.txTypes.payment;
    const FEE_TX_TYPE = config.registerKeys.txTypes.fee;
    const FEE_OUTPUT_TYPE = config.registerKeys.outputTypes.feeClaim;
    const FEE_NONCE_OUTPUT_TYPE = config.registerKeys.outputTypes.feeBlockNum;

    const FEE_AMOUNT = 1000;

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

        describe('When operator creates and mines the first fee transaction', () => {
            let firstFeeTxBytes;
            let firstFeeClaimUtxoPos;
            let firstFeeTxMerkleProof;

            beforeEach(async () => {
                const nextBlockNum = (await this.framework.nextChildBlock()).toNumber();
                const feeOutputs = [
                    new FeeClaimOutput(FEE_OUTPUT_TYPE, FEE_AMOUNT, operatorFeeAddress, ETH),
                    new FeeBlockNumOutput(FEE_NONCE_OUTPUT_TYPE, nextBlockNum),
                ];

                const outputIndex = 0;
                firstFeeClaimUtxoPos = buildUtxoPos(nextBlockNum, 0, outputIndex);

                const firstFeeTx = new FeeTransaction(FEE_TX_TYPE, [], feeOutputs);
                firstFeeTxBytes = web3.utils.bytesToHex(firstFeeTx.rlpEncoded());

                const merkleTree = new MerkleTree([firstFeeTxBytes], MERKLE_TREE_DEPTH);
                firstFeeTxMerkleProof = merkleTree.getInclusionProof(firstFeeTxBytes);

                await this.framework.submitBlock(merkleTree.root, { from: authority });
            });

            describe('And then the operator creates and mines the second fee transaction', () => {
                let secondFeeTxBytes;
                let secondFeeClaimUtxoPos;
                let secondFeeTxMerkleProof;

                beforeEach(async () => {
                    const nextBlockNum = (await this.framework.nextChildBlock()).toNumber();
                    const feeOutputs = [
                        new FeeClaimOutput(FEE_OUTPUT_TYPE, FEE_AMOUNT, operatorFeeAddress, ETH),
                        new FeeBlockNumOutput(FEE_NONCE_OUTPUT_TYPE, nextBlockNum),
                    ];

                    const secondFeeTx = new FeeTransaction(FEE_TX_TYPE, [], feeOutputs);
                    secondFeeTxBytes = web3.utils.bytesToHex(secondFeeTx.rlpEncoded());

                    const outputIndex = 0;
                    secondFeeClaimUtxoPos = buildUtxoPos(nextBlockNum, 0, outputIndex);

                    const merkleTree = new MerkleTree([secondFeeTxBytes], MERKLE_TREE_DEPTH);
                    secondFeeTxMerkleProof = merkleTree.getInclusionProof(secondFeeTxBytes);
                    await this.framework.submitBlock(merkleTree.root, { from: authority });
                });

                describe('And then the operator spends the 2 fee claim outputs in payment transaction', () => {
                    let paymentTxObj;
                    let paymentTxBytes;
                    let paymentOutputUtxoPos;
                    let paymentTxMerkleProof;

                    beforeEach(async () => {
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
                        const tx = await this.paymentExitGame.startStandardExit(
                            args, { from: operatorFeeAddress, value: bondSize },
                        );
                        await expectEvent.inLogs(
                            tx.logs,
                            'ExitStarted',
                            { owner: operatorFeeAddress },
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
                        const tx = await this.paymentExitGame.startInFlightExit(
                            args,
                            { from: alice, value: bondSize },
                        );
                        await expectEvent.inLogs(
                            tx.logs,
                            'InFlightExitStarted',
                        );
                    });
                });
            });
        });
    });
});
