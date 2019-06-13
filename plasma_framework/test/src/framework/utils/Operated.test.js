const Operated = artifacts.require('OperatedMock');

const { expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

contract('Operated', ([operator, other]) => {
    beforeEach(async () => {
        this.operatedContract = await Operated.new();
    });

    describe('onlyOperator', () => {
        it('accepts call when it is from operator', async () => {
            await this.operatedContract.checkOnlyOperator();
            expect(await this.operatedContract.operatorCheckPassed()).to.be.true;
        });
    
        it('rejects call when it is not from operator', async () => {
            await expectRevert(
                this.operatedContract.checkOnlyOperator({from: other}),
                "Not being called by operator"
            );
        });
    });
});
