require('dotenv').config()
const RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  const rootChain = await RootChain.deployed()

  if (process.env.AUTHORITY_PASSPHRASE) {
    // Unlock the authority account if necessary
    await RootChain.web3.eth.personal.unlockAccount(
      process.env.AUTHORITY_ADDRESS,
      process.env.AUTHORITY_PASSPHRASE,
      10
    )
  }
  // Call RootChain.init() from the authority account
  return rootChain.init(process.env.MIN_EXIT_PERIOD, { from: process.env.AUTHORITY_ADDRESS })
}
