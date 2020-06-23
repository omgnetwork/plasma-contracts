const FeeExitGame = artifacts.require('FeeExitGame');
const PlasmaFramework = artifacts.require('PlasmaFramework');

const config = require('../config.js');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const plasmaFramework = await PlasmaFramework.deployed();

    await deployer.deploy(FeeExitGame);
    // const feeExitGame = await FeeExitGame.deployed();

    // await plasmaFramework.registerExitGame(
    //     config.registerKeys.txTypes.fee,
    //     feeExitGame.address,
    //     config.frameworks.protocols.moreVp,
    //     { from: maintainerAddress },
    // );
};
