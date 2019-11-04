require('dotenv').config(); // auto parse env variables from '.env' file

const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
    networks: {
        local: {
            host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
            port: process.env.ETH_CLIENT_PORT || 8545,
            from: process.env.DEPLOYER_ADDRESS,
            gas: 6000000,
            network_id: '*',
        },
        mainnet: {
            host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
            port: process.env.ETH_CLIENT_PORT || 8545,
            from: process.env.DEPLOYER_ADDRESS,
            network_id: 1,
        },
        rinkeby: {
            host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
            port: process.env.ETH_CLIENT_PORT || 8545,
            from: process.env.DEPLOYER_ADDRESS,
            network_id: 4,
        },
        goerli: {
            host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
            port: process.env.ETH_CLIENT_PORT || 8545,
            from: process.env.DEPLOYER_ADDRESS,
            network_id: 5,
        },
        // Remote means that the remote client does not possess the private keys.
        // Transactions need to be signed locally with the given private keys
        // before getting submitted to the remote client.
        remote: {
            skipDryRun: true,
            provider: () => new HDWalletProvider(
                [
                    process.env.DEPLOYER_PRIVATEKEY,
                    process.env.MAINTAINER_PRIVATEKEY,
                    process.env.AUTHORITY_PRIVATEKEY,
                ],
                process.env.REMOTE_URL,
                0, 3,
            ),
            network_id: '*',
        },
    },

    // Set default mocha options here, use special reporters etc.
    mocha: {
        reporter: process.env.MOCHA_REPORTER || '',
        reporterOptions: {
            currency: 'USD',
            showTimeSpent: true,
            src: 'contracts/src/',
        },
    },

    // Configure your compilers
    compilers: {
        solc: {
            version: '0.5.11',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
            },
        },
    },

    plugins: ['solidity-coverage'],
};
