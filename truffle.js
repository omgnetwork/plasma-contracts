require('dotenv').config()
const HDWalletProvider = require('truffle-hdwallet-provider')

module.exports = {
  compilers: {
    solc: {
      version: '0.4.25',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1
        }
      }
    }
  },
  networks: {
    eth_client: {
      host: process.env.ETH_CLIENT_HOST || '127.0.0.1',
      port: process.env.ETH_CLIENT_PORT || 8545,
      from: process.env.DEPLOYER_ADDRESS,
      network_id: '*'
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
      network_id: 4
    }
  }
}
