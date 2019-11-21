const SafeEthTransfer = artifacts.require('SafeEthTransferMock');
const FallbackFunctionFailAttacker = artifacts.require('OutOfGasFallbackAttacker');
const OutOfGasFallbackAttacker = artifacts.require('OutOfGasFallbackAttacker');

const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('SafeEthTransfer', ([_, alice]) => {
    const SAFE_GAS_STIPEND = 2300;
    const TEST_AMOUNT = 100000000;

    beforeEach(async () => {
        this.contract = await SafeEthTransfer.new();
        await this.contract.setupInitialFundToTestTransfer({ value: TEST_AMOUNT });
    });

    describe('transferRevertOnError', () => {
        it('should revert when failed to transfer the fund', async () => {
            const fundMoreThanWhatContractHolds = TEST_AMOUNT + 1;
            await expectRevert(
                this.contract.transferRevertOnError(
                    alice, fundMoreThanWhatContractHolds, SAFE_GAS_STIPEND,
                ),
                'SafeEthTransfer: failed to transfer ETH',
            );
        });

        it('should transfer the fund when successfully called', async () => {
            const preContractBalance = new BN(await web3.eth.getBalance(this.contract.address));
            const preAliceBalance = new BN(await web3.eth.getBalance(alice));

            await this.contract.transferRevertOnError(
                alice, TEST_AMOUNT, SAFE_GAS_STIPEND,
            );

            const postAliceBalance = new BN(await web3.eth.getBalance(alice));
            const postContractBalance = new BN(await web3.eth.getBalance(this.contract.address));

            const expectAliceBalance = preAliceBalance.add(new BN(TEST_AMOUNT));
            const expectContractBalance = preContractBalance.sub(new BN(TEST_AMOUNT));

            expect(postAliceBalance).to.be.bignumber.equal(expectAliceBalance);
            expect(postContractBalance).to.be.bignumber.equal(expectContractBalance);
        });
    });

    describe('transferReturnResult', () => {
        it('should revert when remaining gas is less than the gas stipend', async () => {
            const highGasStipendToFail = 20000;
            const notEnoughGas = 30000;
            await expectRevert(
                this.contract.transferReturnResult(
                    alice, TEST_AMOUNT, highGasStipendToFail, { gas: notEnoughGas },
                ),
                'out of gas',
            );
        });

        it('should return false when the contract does not have enough fund to transfer', async () => {
            const fundMoreThanWhatContractHolds = TEST_AMOUNT + 1;
            await this.contract.transferReturnResult(alice, fundMoreThanWhatContractHolds, SAFE_GAS_STIPEND);
            expect(await this.contract.transferResult()).to.be.false;
        });

        it('should return false when called to a attacking contract that would fail in fallback function', async () => {
            const attacker = await FallbackFunctionFailAttacker.new();
            await this.contract.transferReturnResult(attacker.address, TEST_AMOUNT, SAFE_GAS_STIPEND);
            expect(await this.contract.transferResult()).to.be.false;
        });

        it('should return false when called to a contract that would need more gas than gas stipend', async () => {
            const attacker = await OutOfGasFallbackAttacker.new();
            await this.contract.transferReturnResult(attacker.address, TEST_AMOUNT, SAFE_GAS_STIPEND);
            expect(await this.contract.transferResult()).to.be.false;
        });

        describe('when successfully called', () => {
            let preAliceBalance;
            let preContractBalance;

            beforeEach(async () => {
                preContractBalance = new BN(await web3.eth.getBalance(this.contract.address));
                preAliceBalance = new BN(await web3.eth.getBalance(alice));
                await this.contract.transferReturnResult(
                    alice, TEST_AMOUNT, SAFE_GAS_STIPEND,
                );
            });

            it('should return true when successfully transferred', async () => {
                expect(await this.contract.transferResult()).to.be.true;
            });

            it('should transfer the fund', async () => {
                const postAliceBalance = new BN(await web3.eth.getBalance(alice));
                const postContractBalance = new BN(await web3.eth.getBalance(this.contract.address));

                const expectAliceBalance = preAliceBalance.add(new BN(TEST_AMOUNT));
                const expectContractBalance = preContractBalance.sub(new BN(TEST_AMOUNT));

                expect(postAliceBalance).to.be.bignumber.equal(expectAliceBalance);
                expect(postContractBalance).to.be.bignumber.equal(expectContractBalance);
            });
        });
    });
});
