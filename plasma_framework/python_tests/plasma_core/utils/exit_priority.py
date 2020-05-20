def parse_exit_priority(priority):
    return parse_exitable_at(priority), parse_tx_pos(priority), parse_exit_id(priority)


def parse_exitable_at(priority):
    return priority >> 224  # take 32 most significant bits


def parse_tx_pos(priority):
    return (((priority >> 224) << 224) ^ priority) >> 168  # take 223-168 bits


def parse_exit_id(priority):
    return ((priority >> 168) << 168) ^ priority  # take 168 least significant bits
