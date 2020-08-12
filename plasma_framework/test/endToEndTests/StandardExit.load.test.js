const EthVault = artifacts.require('EthVault');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN, constants } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../helpers/merkle.js');

const { computeDepositOutputId } = require('../helpers/utils.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract('StandardExit getter Load Test', ([_deployer, _maintainer, richFather]) => {
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
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('4', 'ether') });
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
        this.processExitBountySize = await this.exitGame.processStandardExitBountySize();
    };

    const aliceDepositsETH = async () => {
        this.depositUtxoPos = [];
        this.depositTx = [];
        this.merkleProofForDepositTx = [];
        const receipts = [];
        for (let i = 0; i < NUMBER_OF_EXITS; i++) {
            /* eslint-disable no-await-in-loop */
            const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
            this.depositUtxoPos.push(buildUtxoPos(depositBlockNum, 0, 0));
            this.depositTx.push(Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice));
            this.merkleTreeForDepositTx = new MerkleTree([this.depositTx[i]], 16);
            this.merkleProofForDepositTx.push(this.merkleTreeForDepositTx.getInclusionProof(this.depositTx[i]));
            receipts.push(this.ethVault.deposit(this.depositTx[i], { from: alice, value: DEPOSIT_VALUE }));
        }
        return receipts;
    };

    describe('Given contracts deployed, exit game and ETH vault registered', () => {
        before(setupContracts);

        describe('Given Alice deposited with ETH', () => {
            before(async () => {
                await aliceDepositsETH();
            });

            describe('When Alice starts standard exits on the deposit txs', () => {
                before(async () => {
                    const startExits = [];
                    for (let i = 0; i < NUMBER_OF_EXITS; i++) {
                        const args = {
                            utxoPos: this.depositUtxoPos[i],
                            rlpOutputTx: this.depositTx[i],
                            outputType: OUTPUT_TYPE_PAYMENT,
                            outputTxInclusionProof: this.merkleProofForDepositTx[i],
                        };
                        startExits.push(
                            this.exitGame.startStandardExit(args, {
                                from: alice,
                                value: this.startStandardExitBondSize.add(this.processExitBountySize),
                            }),
                        );
                    }
                    await Promise.all([startExits]);
                });

                it('should save the StandardExit data when successfully done', async () => {
                    let exitIds = [];
                    for (let i = 0; i < NUMBER_OF_EXITS; i++) {
                        exitIds.push(this.exitGame.getStandardExitId(true, this.depositTx[i], this.depositUtxoPos[i]));
                    }
                    exitIds = await Promise.all(exitIds);
                    const standardExitData = await this.exitGame.standardExits(exitIds);
                    const outputIndexForDeposit = 0;
                    const outputId = [];

                    for (let i = 0; i < NUMBER_OF_EXITS; i++) {
                        outputId.push(
                            computeDepositOutputId(this.depositTx[i], outputIndexForDeposit, this.depositUtxoPos[i]),
                        );
                        expect(standardExitData[i].exitable).to.be.true;
                        expect(standardExitData[i].outputId).to.equal(outputId[i]);
                        expect(new BN(standardExitData[i].utxoPos)).to.be.bignumber.equal(
                            new BN(this.depositUtxoPos[i]),
                        );
                        expect(standardExitData[i].exitTarget).to.equal(alice);
                        expect(new BN(standardExitData[i].amount)).to.be.bignumber.equal(new BN(DEPOSIT_VALUE));
                    }
                });
            });
        });
    });
});
