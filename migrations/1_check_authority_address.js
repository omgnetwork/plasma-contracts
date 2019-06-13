require('dotenv').config()
var RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  if (process.env.USE_EXISTING_AUTHORITY_ADDRESS) {
    // If using an existing authority address, its nonce must be 0. Abort if it's not.
    const authorityNonce = RootChain.web3.eth.getTransactionCount(process.env.AUTHORITY_ADDRESS)
    if (authorityNonce !== 0) {
      throw new Error(`Authority address ${process.env.AUTHORITY_ADDRESS} nonce is not 0. Aborting...`)
    }
  } else {
    // Check that AUTHORITY_PASSPHRASE is set
    if (!process.env.AUTHORITY_PASSPHRASE) {
      throw new Error("Can't create new Authority address without AUTHORITY_PASSPHRASE")
    }

    // Create a new authority address
    const authorityAddress = await RootChain.web3.eth.personal.newAccount(process.env.AUTHORITY_PASSPHRASE)

    // If no DEPLOYER_ADDRESS is set default to using accounts[0]
    const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || accounts[0]

    // Unlock the deployer account if necessary
    if (process.env.DEPLOYER_PASSPHRASE) {
      await RootChain.web3.eth.personal.unlockAccount(
        DEPLOYER_ADDRESS,
        process.env.DEPLOYER_PASSPHRASE,
        10
      )
    }

    // Fund the authority address
    await RootChain.web3.eth.sendTransaction({
      from: DEPLOYER_ADDRESS,
      to: authorityAddress,
      value: process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 1e18
    })

    // Save the authority address to use later
    process.env.AUTHORITY_ADDRESS = authorityAddress
  }
}
