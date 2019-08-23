require('dotenv').config()
const HDWalletProvider = require('truffle-hdwallet-provider')

module.exports = {
  compilers: {
    solc: {
      version: process.env.SOLC_VERSION || '0.4.25',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1
        }
      }
    }
  },
  networks: {
    local: {
      host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
      port: process.env.ETH_CLIENT_PORT || 8545,
      from: process.env.DEPLOYER_ADDRESS,
      gas: 6000000, // reasoning of the gas here: https://github.com/omisego/plasma-contracts/issues/199
      network_id: '*'
    },
    mainnet: {
      host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
      port: process.env.ETH_CLIENT_PORT || 8545,
      from: process.env.DEPLOYER_ADDRESS,
      network_id: 1
    },
    rinkeby: {
      host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
      port: process.env.ETH_CLIENT_PORT || 8545,
      from: process.env.DEPLOYER_ADDRESS,
      network_id: 4
    },
    goerli: {
      host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
      port: process.env.ETH_CLIENT_PORT || 8545,
      from: process.env.DEPLOYER_ADDRESS,
      network_id: 5
    },
    infura: {
      skipDryRun: true,
      provider: function () {
        return new HDWalletProvider(
          [process.env.DEPLOYER_PRIVATEKEY, process.env.AUTHORITY_PRIVATEKEY],
          `${process.env.INFURA_URL}/${process.env.INFURA_API_KEY}`,
          0, 2
        )
      },
      network_id: '*'
    }
  }
}
