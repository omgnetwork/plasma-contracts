from plasma_core.constants import NULL_ADDRESS_HEX, WEEK


def test_process_exits_in_flight_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    spend_id = testlang.spend_utxo([deposit_id], [owner.key], [(owner.address, 100)])
    testlang.start_in_flight_exit(spend_id)
    testlang.piggyback_in_flight_exit_output(spend_id, 0, owner.key)
    testlang.forward_timestamp(2 * WEEK)

    testlang.process_exits()

    in_flight_exit = testlang.get_in_flight_exit(spend_id)
    assert in_flight_exit.exit_start_timestamp == 0
    assert in_flight_exit.bond_owner == NULL_ADDRESS_HEX
    assert in_flight_exit.oldest_competitor == 0

    for i in range(0, 4):
        input_info = in_flight_exit.get_input(i)
        assert input_info.owner == NULL_ADDRESS_HEX
        assert input_info.amount == 0

        output_info = in_flight_exit.get_output(i)
        assert output_info.owner == NULL_ADDRESS_HEX
        assert output_info.amount == 0


def test_process_exits_standard_exit_should_succeed(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner.address, amount)
    testlang.start_standard_exit(deposit_id, owner.key)
    testlang.forward_timestamp(2 * WEEK)

    testlang.process_exits()

    standard_exit = testlang.get_standard_exit(deposit_id)
    assert standard_exit.owner == NULL_ADDRESS_HEX
    assert standard_exit.amount == amount
