require('dotenv').config()
const RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  console.log(JSON.stringify({
    contract_addr: `${RootChain.address}`.toLowerCase(),
    txhash_contract: `${RootChain.network.transactionHash}`.toLowerCase(),
    authority_addr: `${process.env.AUTHORITY_ADDRESS || accounts[1]}`.toLowerCase()
  }))
}
