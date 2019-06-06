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
    development: {
      host: process.env.GETH_HOST || '127.0.0.1',
      port: process.env.GETH_PORT || 8545,
      network_id: '*'
    },
    rinkeby: {
      skipDryRun: true,
      provider: function () {
        return new HDWalletProvider(
          [process.env.DEPLOYER_PRIVATEKEY, process.env.AUTHORITY_PRIVATEKEY],
          `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
          0, 2
        )
      },
      network_id: 4
    }
  }
}
