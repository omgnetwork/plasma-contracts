/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */
const Migrations = artifacts.require('Migrations');
const fs = require('fs');
const path = require('path');

const fundAddressIfEmpty = async (from, to, value, receiverName) => {
    console.log(`Funding ${receiverName} address ${to}`);
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
    let authority;
    let maintainer;
    const vault = process.env.VAULT || false;
    if (vault === true) {
        authority = fs.readFileSync('vault_authority').toString();
        const multisigInstance = path.resolve(__dirname, '../../MultiSigWallet/build/multisig_instance');
        maintainer = fs.readFileSync(multisigInstance, 'utf8');
        console.log(`Vault authority address: ${authority}`);
        console.log(`Maintainer multisig address: ${maintainer}`);
    } else {
        authority = authorityAddress;
        maintainer = maintainerAddress;
        console.log(`Authority address: ${authority}`);
        console.log(`Maintainer address: ${maintainer}`);
    }
    console.log(`Deployer address: ${deployerAddress}`);
    const initAmountForMaintainer = process.env.MAINTAINER_ADDRESS_INITIAL_AMOUNT || 2e17; // 0.2 ETH by default
    const initAmountForAuthority = process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 2e17; // 0.2 ETH by default

    await fundAddressIfEmpty(deployerAddress, maintainer, initAmountForMaintainer, 'maintainer');
    await fundAddressIfEmpty(deployerAddress, authority, initAmountForAuthority, 'authority');

    await outputAddressFunds(deployerAddress, 'Deployer');
    await outputAddressFunds(maintainer, 'Maintainer');
    await outputAddressFunds(authority, 'Authority');

    console.log('\n########################### Notice ############################');
    console.log('It is recommended to have 0.2 ETH in the maintainer and authority address');
    console.log('With 1.0 ETH in the deployer address');
    console.log('Otherwise the deployement might fail');
    console.log('###############################################################\n');

    // Deploy migrations
    await deployer.deploy(Migrations);
};
