const FeeExitGame = artifacts.require('FeeExitGame');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    await deployer.deploy(FeeExitGame);
};
