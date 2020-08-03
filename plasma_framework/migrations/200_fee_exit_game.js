const FeeExitGame = artifacts.require('FeeExitGame');	

const config = require('../config.js');	

module.exports = async (	
    deployer,	
    _,	
    // eslint-disable-next-line no-unused-vars	
    [deployerAddress, maintainerAddress, authorityAddress],	
) => {	

    await deployer.deploy(FeeExitGame);	
    const feeExitGame = await FeeExitGame.deployed();	

};