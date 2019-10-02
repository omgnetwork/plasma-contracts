/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */

const Migrations = artifacts.require('Migrations');

const fundAddressIfEmpty = async (from, to, value, receiverName) => {
    const balanceWeiCount = await Migrations.web3.eth.getBalance(to);

    if (parseInt(balanceWeiCount, 10) === 0) {
        console.log(`Funding ${receiverName} address...`);
        await Migrations.web3.eth.sendTransaction({
            from,
            to,
            value,
        });
        console.log(`Successfully funded ${receiverName} address.`);
    }
};

module.exports = async (deployer, network, accounts) => {
    // TODO: take env var into consideration
    global.deployerAddress = accounts[0];
    global.maintainerAddress = accounts[1];
    global.authorityAddress = accounts[2];

    console.log(`Deployer address: ${global.deployerAddress}`);
    console.log(`Maintainer address: ${global.maintainerAddress}`);
    console.log(`Authority address: ${global.authorityAddress}`);

    const initAmountForMaintainer = process.env.MAINTAINER_ADDRESS_INITIAL_AMOUNT || 1e18; // 1 ETH by default
    const initAmountForAuthority = process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 1e18; // 1 ETH by default
    await fundAddressIfEmpty(global.deployerAddress, global.maintainerAddress, initAmountForMaintainer, 'maintainer');
    await fundAddressIfEmpty(global.deployerAddress, global.authorityAddress, initAmountForAuthority, 'authority');

    // Deploy migrations
    await deployer.deploy(Migrations);
};
