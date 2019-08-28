require('dotenv').config()
const RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  const rootChain = await RootChain.deployed()

  // Unlock the deployer account if not using Infura
  // As infura doesn't support eth_unlockAccount
  if (process.env.AUTHORITY_PASSPHRASE &&
    !process.env.AUTHORITY_PRIVATEKEY && 
    !process.env.DEPLOYER_PRIVATEKEY
  ) {
    // Unlock the authority account if necessary
    await RootChain.web3.eth.personal.unlockAccount(
      global.authorityAddress,
      process.env.AUTHORITY_PASSPHRASE,
      10
    )
  }
  // Call RootChain.init() from the authority account
  return rootChain.init(
    process.env.MIN_EXIT_PERIOD,
    { from: global.authorityAddress }
  )
}
