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

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    console.log(`Deployer address: ${deployerAddress}`);
    console.log(`Maintainer address: ${maintainerAddress}`);
    console.log(`Authority address: ${authorityAddress}`);

    const initAmountForMaintainer = process.env.MAINTAINER_ADDRESS_INITIAL_AMOUNT || 1e18; // 1 ETH by default
    const initAmountForAuthority = process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 1e18; // 1 ETH by default
    await fundAddressIfEmpty(deployerAddress, maintainerAddress, initAmountForMaintainer, 'maintainer');
    await fundAddressIfEmpty(deployerAddress, authorityAddress, initAmountForAuthority, 'authority');

    // Deploy migrations
    await deployer.deploy(Migrations);
};
