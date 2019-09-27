const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds

// Number of vaults that can bypass the quarantined period
const INITIAL_IMMUNE_VAULTS = 2; // Preserved 2 for ETH and ERC20 vault

// Number of of exit games that can bypass the quarantined period
const INITIAL_IMMUNE_EXIT_GAMES = 1; // Preserved 1 for PaymentExitGame

const PROTOCOL = {
    MVP: 1,
    MORE_VP: 2,
};

module.exports = {
    MIN_EXIT_PERIOD,
    INITIAL_IMMUNE_VAULTS,
    INITIAL_IMMUNE_EXIT_GAMES,
    PROTOCOL,
};
