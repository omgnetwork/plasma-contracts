/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */
const https = require('https');
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
    var authority = authorityAddress;
    const vault = process.env.VAULT || false;
    if (vault) {
        const chain_id = `${process.env.CHAIN_ID}` || 1;
        const rpc_url = process.env.VAULT_RPC_REMOTE_URL || 'http://127.0.0.1:8545';
        const walletName = 'plasma-deployer';
        // configuration
        var options = {
            host: `${process.env.VAULT_ADDR}`,
            port: `${process.env.VAULT_PORT}`,
            path: '/v1/immutability-eth-plugin/config',
            method: 'PUT',
            headers: { 
                "X-Vault-Token" : `${process.env.VAULT_TOKEN}`,
                "X-Vault-Request" : true,
            }
        };
        var callback = function(response) {
            var str = ''
            response.on('data', function(chunk){
                str += chunk
            })

            response.on('end', function(){
                const response_object = JSON.parse(str);
                if (response_object.data.chain_id != chain_id || response_object.data.rpc_url != rpc_url){
                    throw 'Vault configuration did not stick';
                }
            })
        }
        var body = JSON.stringify({
            chain_id: chain_id,
            rpc_url: rpc_url
        });
        https.request(options, callback).end(body);
        // wallet 
        options.path = `/v1/immutability-eth-plugin/wallets/${walletName}`;

        callback = function(response) {

            var str = ''
            response.on('data', function(chunk){
                str += chunk
            })

            response.on('end', function(){
                const response_object = JSON.parse(str);
                if (typeof response_object.request_id !== 'string'){
                    console.log(str);
                    throw 'Creating wallet failed';
                }
            })
        }
        https.request(options, callback).end(JSON.stringify({}));
        // account
        options.path = `/v1/immutability-eth-plugin/wallets/${walletName}/accounts`;

        callback = function(response) {

            var str = ''
            response.on('data', function(chunk){
                str += chunk
            })

            response.on('end', function(){
                const response_object = JSON.parse(str);
                console.log(response_object);
                if (typeof response_object.data.address !== 'string'){
                    throw 'Creating account failed';
                }else{
                    authority = response_object.data.address;
                }
            })
        }
        await https.request(options, callback).end(JSON.stringify({}));

    }else{
        console.log(`Deployer address: ${deployerAddress}`);
        console.log(`Maintainer address: ${maintainerAddress}`);
        
    }
    console.log(`Authority address: ${authority}`);
    const initAmountForMaintainer = process.env.MAINTAINER_ADDRESS_INITIAL_AMOUNT || 2e17; // 0.2 ETH by default
    const initAmountForAuthority = process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 2e17; // 0.2 ETH by default

    await fundAddressIfEmpty(deployerAddress, maintainerAddress, initAmountForMaintainer, 'maintainer');
    await fundAddressIfEmpty(deployerAddress, authority, initAmountForAuthority, 'authority');

    await outputAddressFunds(deployerAddress, 'Deployer');
    await outputAddressFunds(maintainerAddress, 'Maintainer');
    await outputAddressFunds(authority, 'Authority');

    console.log('\n########################### Notice ############################');
    console.log('It is recommended to have 0.2 ETH in the maintainer and authority address');
    console.log('With 1.0 ETH in the deployer address');
    console.log('Otherwise the deployement might fail');
    console.log('###############################################################\n');

    // Deploy migrations
    await deployer.deploy(Migrations);
};
