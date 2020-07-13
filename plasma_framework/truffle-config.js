require('dotenv').config(); // auto parse env variables from '.env' file
var fs = require('fs');
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
    networks: {
        loadTest: {
            host: '127.0.0.1',
            port: 8545,
            network_id: '*',
            gas: 0xfffffffffff,
        },
        local: {
            host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
            port: process.env.ETH_CLIENT_PORT || 8545,
            from: process.env.DEPLOYER_ADDRESS,
            network_id: '*',
        },
        // Remote means that the remote client does not possess the private keys.
        // Transactions need to be signed locally with the given private keys
        // before getting submitted to the remote client.
        remote: {
            skipDryRun: true,
            provider: () => new HDWalletProvider(
                [
                    process.env.DEPLOYER_PRIVATEKEY || '0'.repeat(64),
                    fs.readFileSync('../MultiSigWallet/build/multisig_instance') || process.env.MAINTAINER_PRIVATEKEY || '0'.repeat(64),
                    process.env.AUTHORITY_PRIVATEKEY || '0'.repeat(64),
                ],
                process.env.REMOTE_URL || 'http://127.0.0.1:8545',
                0, 3,
            ),
            gasPrice: process.env.GAS_PRICE || 20000000000, // default 20 gwei
            network_id: '*',
        },
    },

    // Set default mocha options here, use special reporters etc.
    mocha: {
        reporter: process.env.MOCHA_REPORTER || '',
        reporterOptions: {
            currency: 'USD',
            showTimeSpent: true,
            rst: true,
            rstTitle: 'Gas Report',
            outputFile: './gasReport.rst',
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
