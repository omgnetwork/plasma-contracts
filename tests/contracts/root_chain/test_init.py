import pytest
from eth_tester.exceptions import TransactionFailed

pytestmark = pytest.mark.skip()

EXIT_PERIOD = 4 * 60


@pytest.fixture
def utxo(testlang_root_chain_short_exit_period):
    return testlang_root_chain_short_exit_period.create_utxo()


def test_cant_ever_init_twice(root_chain, accounts):
    with pytest.raises(TransactionFailed):
        root_chain.init(EXIT_PERIOD, **{'from': accounts[0].address})


def test_exit_period_setting_has_effect(testlang_root_chain_short_exit_period, w3):
    owner = testlang_root_chain_short_exit_period.accounts[0]
    deposit_id = testlang_root_chain_short_exit_period.deposit(owner, 100)

    spend_id = testlang_root_chain_short_exit_period.spend_utxo([deposit_id], [owner])
    testlang_root_chain_short_exit_period.start_in_flight_exit(spend_id)

    w3.eth.increase_time(2)  # explicitly forward time to the second period

    with pytest.raises(TransactionFailed):
        testlang_root_chain_short_exit_period.piggyback_in_flight_exit_input(spend_id, 0, owner)
