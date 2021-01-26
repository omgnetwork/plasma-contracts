require('dotenv').config(); // auto parse env variables from '.env' file
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 4000000,
      gasPrice: 10000000000, // 10 gwei
    },
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
    remote: {
      gasPrice: process.env.GAS_PRICE || 20000000000, // default 20 gwei
      skipDryRun: true,
      provider: () => new HDWalletProvider(
          [
              process.env.DEPLOYER_PRIVATEKEY || '0'.repeat(64),
          ],
          process.env.REMOTE_URL || 'http://127.0.0.1:8545',
          0, 1,
      ),
      network_id: '*',
    }
  },
  // Configure your compilers
  compilers: {
    solc: {
        version: '0.4.15'
    },
  }
};
