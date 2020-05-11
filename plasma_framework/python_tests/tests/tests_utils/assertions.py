def assert_events(events_objects, expected_events):
    assert len(events_objects) == len(expected_events)

    # sort received and expected events by name
    events_objects = sorted(events_objects, key=lambda e: e[1].event)
    expected_events = sorted(expected_events, key=lambda e: e[0])

    for event_obj, expected_event in zip(events_objects, expected_events):
        assert_event(event_obj, *expected_event)


def assert_event(event_obj, expected_event_name, expected_event_args=None, expected_contract_address=None):
    contract_address, event = event_obj

    if expected_event_args is None:
        expected_event_args = {}

    if expected_contract_address:
        assert contract_address == expected_contract_address

    assert event['event'] == expected_event_name
    assert expected_event_args.items() <= event['args'].items()
