const PlasmaFramework = artifacts.require('PlasmaFramework');

module.exports = async (deployer) => {
    const ETH_VAULT_NUMBER = 1; // Value Number
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const INITIAL_IMMUNE_VAULTS = 2; // ETH and ERC20 vault
    const INITIAL_IMMUNE_EXIT_GAMES = 1; // 1 for PaymentExitGame

    await deployer.deploy(
        PlasmaFramework,
        MIN_EXIT_PERIOD,
        INITIAL_IMMUNE_VAULTS,
        INITIAL_IMMUNE_EXIT_GAMES,
        { from: global.authorityAddress },
    );

    const plasmaFramework = await PlasmaFramework.deployed();
    await plasmaFramework.initAuthority();
};
