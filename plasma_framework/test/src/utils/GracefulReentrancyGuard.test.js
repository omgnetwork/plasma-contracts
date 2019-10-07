const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');

const Attacker = artifacts.require('GracefulReentrancyGuardAttacker');

contract('GracefulReentrancyGuard', () => {
    beforeEach(async () => {
        this.attacker = await Attacker.new();
    });

    it('should not allow local recursion', async () => {
        await expectRevert(
            this.attacker.guardedLocal(),
            'Reentrant call',
        );
    });

    it('should not allow remote reentrancy but should not fail the top call', async () => {
        const { receipt } = await this.attacker.guardedRemote();
        await expectEvent.inTransaction(
            receipt.transactionHash,
            Attacker,
            'RemoteCallFailed',
        );
    });
});
