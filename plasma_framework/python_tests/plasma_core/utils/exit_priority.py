def parse_exit_priority(priority):
    return parse_exitable_at(priority), parse_tx_pos(priority), parse_exit_id(priority)


def parse_exitable_at(priority):
    return priority >> 214  # take 42 most significant bits


def parse_tx_pos(priority):
    return (((priority >> 214) << 214) ^ priority) >> 160  # take 213-160 bits


def parse_exit_id(priority):
    return ((priority >> 160) << 160) ^ priority  # take 160 least significant bits
