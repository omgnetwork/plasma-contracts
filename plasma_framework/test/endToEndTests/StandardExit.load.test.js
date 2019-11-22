const EthVault = artifacts.require('EthVault');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { EMPTY_BYTES, SAFE_GAS_STIPEND } = require('../helpers/constants.js');
const { MerkleTree } = require('../helpers/merkle.js');

const {
    computeDepositOutputId, computeNormalOutputId, spentOnGas, exitQueueKey,
} = require('../helpers/utils.js');
const { sign } = require('../helpers/sign.js');
const { hashTx } = require('../helpers/paymentEip712.js');
const { buildUtxoPos, utxoPosToTxPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract('StandardExit getter Load Test', ([_deployer, _maintainer, authority, bob, richFather]) => {
    const ETH = constants.ZERO_ADDRESS;
    const DEPOSIT_VALUE = 1;
    const NUMBER_OF_EXITS = 50;
    const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('2', 'ether') });
    };

    before(async () => {
        await Promise.all([setupAccount()]);
    });

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.deployed();

        this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));

        this.exitGame = await PaymentExitGame.at(await this.framework.exitGames(config.registerKeys.txTypes.payment));

        this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
    

        this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
    };

    const aliceDepositsETH = async () => {
        this.depositUtxoPos = [];
        this.depositTx = [];
        this.merkleTreeForDepositTx = [];
        this.merkleProofForDepositTx = [];
        let receipts = [];

        for (i = 0; i < NUMBER_OF_EXITS; i++) {
            const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
            this.depositUtxoPos[i] = buildUtxoPos(depositBlockNum, 0, 0);
            this.depositTx[i] = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
            this.merkleTreeForDepositTx[i] = new MerkleTree([this.depositTx[i]], 16);
            this.merkleProofForDepositTx[i] = this.merkleTreeForDepositTx[i].getInclusionProof(this.depositTx[i]);
            receipts[i] = this.ethVault.deposit(this.depositTx[i], { from: alice, value: DEPOSIT_VALUE })
        }    
        return receipts;
    };

    describe('Given contracts deployed, exit game and ETH vault registered', () => {
        before(setupContracts);

        describe('Given Alice deposited with ETH', () => {
            before(async () => {
                this.aliceBalanceBeforeDeposit = new BN(await web3.eth.getBalance(alice));
                this.ethVaultBalanceBeforeDeposit = new BN(await web3.eth.getBalance(this.ethVault.address));
                const receipts = await aliceDepositsETH();
                let receipts2 = [];
                for (i = 0; i < NUMBER_OF_EXITS; i++) {
                    
                    receipts2[i] = await receipts[i];
                }
                this.aliceDepositReceipts = [];
                this.aliceDepositReceipts = receipts;
            });

            describe('When Alice starts standard exit on the deposit tx', () => {
                before(async () => {
                    for (i = 0; i < NUMBER_OF_EXITS; i++) {
                        const args = {
                            utxoPos: this.depositUtxoPos[i],
                            rlpOutputTx: this.depositTx[i],
                            outputType: OUTPUT_TYPE_PAYMENT,
                            outputGuardPreimage: EMPTY_BYTES,
                            outputTxInclusionProof: this.merkleProofForDepositTx[i],
                        };
                        await this.exitGame.startStandardExit(
                            args, { from: alice, value: this.startStandardExitBondSize },
                        );
                    }
                });

                it('should save the StandardExit data when successfully done', async () => {
                    let exitIds = [];
                    for (i = 0; i < NUMBER_OF_EXITS; i++) {
                        exitIds[i] = await this.exitGame.getStandardExitId(true, this.depositTx[i], this.depositUtxoPos[i]);
                    }
                    const standardExitData = (await this.exitGame.standardExits(exitIds));
                    const outputIndexForDeposit = 0;
                    let outputId = [];

                    for (i = 0; i < NUMBER_OF_EXITS; i++) {
                        outputId[i] = computeDepositOutputId(this.depositTx[i], outputIndexForDeposit, this.depositUtxoPos[i]);
                        expect(standardExitData[i].exitable).to.be.true;
                        expect(standardExitData[i].outputId).to.equal(outputId[i]);
                        expect(new BN(standardExitData[i].utxoPos)).to.be.bignumber.equal(new BN(this.depositUtxoPos[i]));
                        expect(standardExitData[i].exitTarget).to.equal(alice);
                        expect(new BN(standardExitData[i].amount)).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                    }
                });
            });
        });
    });
});
