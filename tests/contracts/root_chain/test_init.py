import pytest
from eth_tester.exceptions import TransactionFailed


EXIT_PERIOD = 4 * 60


@pytest.fixture
def utxo(testlang_root_chain_short_exit_period):
    return testlang_root_chain_short_exit_period.create_utxo()


def test_cant_ever_init_twice(ethtester, root_chain):
    ethtester.chain.mine()
    with pytest.raises(TransactionFailed):
        root_chain.init(EXIT_PERIOD, sender=ethtester.k0)


def test_exit_period_setting_has_effect(testlang_root_chain_short_exit_period):
    owner = testlang_root_chain_short_exit_period.accounts[0]
    deposit_id = testlang_root_chain_short_exit_period.deposit(owner, 100)

    spend_id = testlang_root_chain_short_exit_period.spend_utxo([deposit_id], [owner.key])

    testlang_root_chain_short_exit_period.start_in_flight_exit(spend_id)

    with pytest.raises(TransactionFailed):
        testlang_root_chain_short_exit_period.piggyback_in_flight_exit_input(spend_id, 0, owner.key)
