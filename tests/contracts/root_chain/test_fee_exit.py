import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.constants import NULL_ADDRESS_HEX


def test_start_fee_exit_should_succeed(testlang):
    operator, amount = testlang.accounts[0], 100

    fee_exit_id = testlang.start_fee_exit(operator, amount)

    plasma_exit = testlang.get_standard_exit(fee_exit_id)
    assert plasma_exit.owner == operator.address
    assert plasma_exit.token == NULL_ADDRESS_HEX
    assert plasma_exit.amount == amount


def test_start_fee_exit_non_operator_should_fail(testlang):
    amount = 100

    with pytest.raises(TransactionFailed):
        testlang.start_fee_exit(testlang.accounts[1], amount)
