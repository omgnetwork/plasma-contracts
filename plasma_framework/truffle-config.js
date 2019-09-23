require('dotenv').config(); // auto parse env variables from '.env' file

const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {
    networks: {
        local: {
            host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
            port: process.env.ETH_CLIENT_PORT || 8545,
            from: process.env.DEPLOYER_ADDRESS,
            gas: 8000000, // TODO: move to lower value
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
        infura: {
            skipDryRun: true,
            provider: () => {
                const infuraUrl = `${process.env.INFURA_URL}/${process.env.INFURA_API_KEY}`;

                // Replace double '//'
                const cleanInfuraUrl = infuraUrl.replace(/([^:])(\/\/+)/g, '$1/');

                return new HDWalletProvider(
                    [process.env.DEPLOYER_PRIVATEKEY, process.env.AUTHORITY_PRIVATEKEY],
                    cleanInfuraUrl,
                    0, 2,
                );
            },
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
            version: '0.5.11', // Fetch exact version from solc-bin (default: truffle's version)
            // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
            // settings: {          // See the solidity docs for advice about optimization and evmVersion
            optimizer: {
                enabled: false,
                runs: 200,
            },
            //  evmVersion: "byzantium"
            // }
        },
    },
};
