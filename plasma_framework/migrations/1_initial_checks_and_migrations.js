/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */

const Migrations = artifacts.require('Migrations');

const fundAddressIfEmpty = async (from, to, value, receiverName) => {
    const balanceWeiCount = await Migrations.web3.eth.getBalance(to);
    const balanceEthCount = Migrations.web3.utils.fromWei(balanceWeiCount.toString());
    const fundEthCount = Migrations.web3.utils.fromWei(value.toString());

    if (parseInt(balanceWeiCount, 10) === 0) {
        console.log(`Funding ${receiverName} address with ${fundEthCount} ETH...`);
        await Migrations.web3.eth.sendTransaction({
            from,
            to,
            value,
        });
        console.log(`Successfully funded ${receiverName} address.`);
    } else {
        console.log(`${receiverName} already has ${balanceEthCount} ETH, skipping funding.`);
    }
};

const outputAddressFunds = async (addr, addrName) => {
    const balanceWeiCount = await Migrations.web3.eth.getBalance(addr);
    const balanceEthCount = Migrations.web3.utils.fromWei(balanceWeiCount.toString());
    console.log(`${addrName} contains ${balanceEthCount} ETH`);
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

    const initAmountForMaintainer = process.env.MAINTAINER_ADDRESS_INITIAL_AMOUNT || 3e17; // 0.3 ETH by default
    const initAmountForAuthority = process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 3e17; // 0.3 ETH by default

    await fundAddressIfEmpty(deployerAddress, maintainerAddress, initAmountForMaintainer, 'maintainer');
    await fundAddressIfEmpty(deployerAddress, authorityAddress, initAmountForAuthority, 'authority');

    await outputAddressFunds(deployerAddress, 'Deployer');
    await outputAddressFunds(maintainerAddress, 'Maintainer');
    await outputAddressFunds(authorityAddress, 'Authority');

    // Deploy migrations
    await deployer.deploy(Migrations);
};
