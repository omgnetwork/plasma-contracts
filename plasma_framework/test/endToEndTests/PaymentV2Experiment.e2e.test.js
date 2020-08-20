const EthVault = artifacts.require('EthVault');
const Erc20Vault = artifacts.require('Erc20Vault');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');
const ExitPriority = artifacts.require('ExitPriorityWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');
const PaymentExitGame = artifacts.require('PaymentExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const { BN, constants, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../helpers/merkle.js');
const { PaymentTransactionOutput, PaymentTransaction } = require('../helpers/transaction.js');
const { buildUtxoPos } = require('../helpers/positions.js');
const Testlang = require('../helpers/testlang.js');
const config = require('../../config.js');

contract('PaymentExitGame - V2 Extension experiment', ([_deployer, _maintainer, authority, richFather, otherAddress]) => {
    const ETH = constants.ZERO_ADDRESS;
    const INITIAL_ERC20_SUPPLY = 10000000000;
    const DEPOSIT_VALUE = 1000000;
    const OUTPUT_TYPE_PAYMENT = config.registerKeys.outputTypes.payment;
    const OUTPUT_TYPE_PAYMENT_V2 = config.registerKeys.outputTypes.paymentV2;
    const PAYMENT_V2_TX_TYPE = config.registerKeys.txTypes.paymentV2;
    const MERKLE_TREE_DEPTH = 16;

    const alicePrivateKey = '0x7151e5dab6f8e95b5436515b83f423c4df64fe4c6149f864daa209b26adb10ca';
    let alice;

    const setupAccount = async () => {
        const password = 'password1234';
        alice = await web3.eth.personal.importRawKey(alicePrivateKey, password);
        alice = web3.utils.toChecksumAddress(alice);
        web3.eth.personal.unlockAccount(alice, password, 3600);
        web3.eth.sendTransaction({ to: alice, from: richFather, value: web3.utils.toWei('1', 'ether') });
    };

    const deployStableContracts = async () => {
        this.exitPriorityHelper = await ExitPriority.new();

        this.erc20 = await ERC20Mintable.new();
        await this.erc20.mint(richFather, INITIAL_ERC20_SUPPLY);
        this.exitableHelper = await ExitableTimestamp.new(config.frameworks.minExitPeriod);
    };

    before(async () => {
        await Promise.all([setupAccount(), deployStableContracts()]);
    });

    const setupContracts = async () => {
        this.framework = await PlasmaFramework.deployed();

        this.ethVault = await EthVault.at(await this.framework.vaults(config.registerKeys.vaultId.eth));
        this.erc20Vault = await Erc20Vault.at(await this.framework.vaults(config.registerKeys.vaultId.erc20));

        this.exitGame = await PaymentExitGame.at(await this.framework.exitGames(PAYMENT_V2_TX_TYPE));

        this.startStandardExitBondSize = await this.exitGame.startStandardExitBondSize();
        this.piggybackBondSize = await this.exitGame.piggybackBondSize();

        this.framework.addExitQueue(config.registerKeys.vaultId.eth, ETH);
        this.dummyGasPrice = 1000000000;
        this.processExitBountySize = await this.exitGame.processStandardExitBountySize(this.dummyGasPrice);
    };

    const aliceDepositsETH = async () => {
        const depositBlockNum = (await this.framework.nextDepositBlock()).toNumber();
        this.depositUtxoPos = buildUtxoPos(depositBlockNum, 0, 0);
        this.depositTx = Testlang.deposit(OUTPUT_TYPE_PAYMENT, DEPOSIT_VALUE, alice);
        this.merkleTreeForDepositTx = new MerkleTree([this.depositTx], MERKLE_TREE_DEPTH);
        this.merkleProofForDepositTx = this.merkleTreeForDepositTx.getInclusionProof(this.depositTx);

        return this.ethVault.deposit(this.depositTx, { from: alice, value: DEPOSIT_VALUE });
    };

    const aliceUpgradeFromPaymentV1ToV2 = async () => {
        const upgradeTxBlockNum = (await this.framework.nextChildBlock()).toNumber();
        this.upgradeUtxoPos = buildUtxoPos(upgradeTxBlockNum, 0, 0);

        const upgradeAmount = DEPOSIT_VALUE;
        const outputV2 = new PaymentTransactionOutput(OUTPUT_TYPE_PAYMENT_V2, upgradeAmount, alice, ETH);

        this.upgradeTxObject = new PaymentTransaction(PAYMENT_V2_TX_TYPE, [this.depositUtxoPos], [outputV2]);
        this.upgradeTx = web3.utils.bytesToHex(this.upgradeTxObject.rlpEncoded());
        this.merkleTreeForUpgradeTx = new MerkleTree([this.upgradeTx]);
        this.merkleProofForUpgradeTx = this.merkleTreeForUpgradeTx.getInclusionProof(this.upgradeTx);

        await this.framework.submitBlock(this.merkleTreeForUpgradeTx.root, { from: authority });
    };

    const isExperiment = process.env.EXPERIMENT || false;
    if (isExperiment) {
        describe('Given contracts deployed, exit game and both ETH and ERC20 vault registered', () => {
            before(setupContracts);

            describe('Given Alice deposited ETH and upgrade the output from payment v1 to v2', () => {
                before(async () => {
                    await aliceDepositsETH();
                    await aliceUpgradeFromPaymentV1ToV2();
                });

                describe('When Alice tries to start the standard exit on the payment v2 output', () => {
                    before(async () => {
                        const args = {
                            utxoPos: this.upgradeUtxoPos,
                            rlpOutputTx: this.upgradeTx,
                            outputTxInclusionProof: this.merkleProofForUpgradeTx,
                        };

                        await this.exitGame.startStandardExit(args, {
                            from: alice,
                            value: this.startStandardExitBondSize.add(this.processExitBountySize),
                            gasPrice: this.dummyGasPrice,
                        });
                    });

                    it('should start successfully', async () => {
                        const exitId = await this.exitGame.getStandardExitId(
                            false,
                            this.upgradeTx,
                            this.upgradeUtxoPos,
                        );
                        const exitIds = [exitId];
                        const standardExitData = (await this.exitGame.standardExits(exitIds))[0];
                        expect(standardExitData.exitable).to.be.true;
                    });

                    describe('And then someone processes the exits for ETH after two weeks', () => {
                        before(async () => {
                            await time.increase(time.duration.weeks(2).add(time.duration.seconds(1)));

                            this.bobBalanceBeforeProcessExit = new BN(await web3.eth.getBalance(alice));

                            await this.framework.processExits(
                                config.registerKeys.vaultId.eth,
                                ETH,
                                0,
                                1,
                                web3.utils.keccak256(otherAddress),
                                { from: otherAddress },
                            );
                        });

                        it('should return the output amount plus standard exit bond to Alice', async () => {
                            const actualBobBalanceAfterProcessExit = new BN(await web3.eth.getBalance(alice));
                            const expectedBobBalance = this.bobBalanceBeforeProcessExit
                                .add(this.startStandardExitBondSize)
                                .add(new BN(this.upgradeTxObject.outputs[0].amount));

                            expect(actualBobBalanceAfterProcessExit).to.be.bignumber.equal(expectedBobBalance);
                        });
                    });
                });
            });
        });
    }
});
