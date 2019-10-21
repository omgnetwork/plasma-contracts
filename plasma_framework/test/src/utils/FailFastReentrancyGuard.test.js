const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');

const Attacker = artifacts.require('FailFastReentrancyGuardAttacker');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');

const { PROTOCOL, TX_TYPE } = require('../../helpers/constants.js');

contract('FailFastReentrancyGuard', () => {
    const MIN_EXIT_PERIOD = 1;
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;

    beforeEach(async () => {
        const framework = await SpyPlasmaFramework.new(
            MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
        );
        this.attacker = await Attacker.new(framework.address);
        await framework.registerExitGame(TX_TYPE.PAYMENT, this.attacker.address, PROTOCOL.MORE_VP);
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
