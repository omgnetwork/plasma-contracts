require('dotenv').config()
var RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    // Create and fund a new authority address
    const auth = await RootChain.web3.eth.personal.newAccount(process.env.AUTHORITY_PASSPHRASE)
    // (assumes an unlocked accounts[0])
    await RootChain.web3.eth.sendTransaction({
      from: accounts[0],
      to: auth,
      value: 1e18
    })
    process.env.AUTHORITY_ADDRESS = auth
  } else {
    // Check that the authority address nonce is 0, abort if not.
    const authorityNonce = RootChain.web3.eth.getTransactionCount(process.env.AUTHORITY_ADDRESS)
    if (authorityNonce !== 0) {
      throw new Error(`Authority address ${process.env.AUTHORITY_ADDRESS} nonce is not 0. Aborting...`)
    }
  }
}
