/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */

const Migrations = artifacts.require('Migrations');

module.exports = async (deployer, network, accounts) => {
    // Addresses
    global.deployerAddress = accounts[0];
    global.authorityAddress = accounts[1];

    console.log(`Deployer address: ${global.deployerAddress}`);
    console.log(`Authority address: ${global.authorityAddress}`);

    // Fund authority address if needed
    const authorithyWeiCount = await Migrations.web3.eth.getBalance(global.authorityAddress);

    // Fund authority if it has 0 funds
    if (parseInt(authorithyWeiCount, 10) === 0) {
        // Funds authority address
        console.log('Funding authority address...');
        await Migrations.web3.eth.sendTransaction({
            from: global.deployerAddress,
            to: global.authorityAddress,
            value: process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 1e18, // 1 ETH by default
        });
        console.log('Successfully funded authority address.');
    }

    // Deploy migrations
    deployer.deploy(Migrations);
};
