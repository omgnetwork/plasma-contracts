/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */
const axios = require('axios');
const fs = require('fs');

module.exports = async (
    _deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [_deployerAddress, _maintainerAddress, _authorityAddress],
) => {
    const authorityExists = fs.existsSync('vault_authority');
    const vault = process.env.VAULT || false;
    if (vault && authorityExists === false) {
        const chainId = `${process.env.CHAIN_ID}` || 1;
        const rpcUrl = process.env.VAULT_RPC_REMOTE_URL || 'http://127.0.0.1:8545';
        const walletName = 'plasma-deployer';
        // configuration
        const options = {
            url: `${process.env.VAULT_ADDR}/v1/immutability-eth-plugin/config`,
            method: 'PUT',
            headers: {
                'X-Vault-Token': `${process.env.VAULT_TOKEN}`,
                'X-Vault-Request': true,
            },
            data: JSON.stringify({
                chain_id: chainId,
                rpc_url: rpcUrl,
            }),
        };
        console.log('Configuring vault');
        let response = await axios(options);
        let responseObject = response.data;
        if (responseObject.data.chain_id !== chainId && responseObject.data.rpc_url !== rpcUrl) {
          throw new Error('Vault configuration did not stick');
        } 
        // wallet
        console.log('Creating wallet');
        options.url = `${process.env.VAULT_ADDR}/v1/immutability-eth-plugin/wallets/${walletName}`;
        delete options.data;
        response = await axios(options);
        responseObject = response.data;
        if (typeof responseObject.request_id !== 'string') {
            throw new Error('Creating wallet failed');
        }
        // account
        console.log('Creating account');
        options.url = `${process.env.VAULT_ADDR}/v1/immutability-eth-plugin/wallets/${walletName}/accounts`;
        response = await axios(options);
        responseObject = response.data;
        if (typeof responseObject.data.address !== 'string') {
            throw new Error('Creating account failed');
        } else {
            console.log(`Authority account now in vault ${responseObject.data.address}`);
            fs.writeFileSync('vault_authority', `${responseObject.data.address}`.toLowerCase());
        }
        console.log('Done');
    } else {
        console.log(`Skipping because Vault ${vault} or perhaps authority exists ${authorityExists}`);
    }
};
