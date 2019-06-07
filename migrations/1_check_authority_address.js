require('dotenv').config()
var RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  if (process.env.CREATE_AUTHORITY_ADDRESS) {
    // Validate configuration vars
    if (!process.env.AUTHORITY_PASSPHRASE) {
      throw new Error("Can't create new Authority address without AUTHORITY_PASSPHRASE")
    }

    // Create a new authority address
    const authorityAddress = await RootChain.web3.eth.personal.newAccount(process.env.AUTHORITY_PASSPHRASE)

    // If no FAUCET_ADDRESS specified use accounts[0]
    const FAUCET_ADDRESS = process.env.FAUCET_ADDRESS || accounts[0]

    // Unlock the faucet account if necessary
    if (process.env.FAUCET_PASSPHRASE) {
      await RootChain.web3.eth.personal.unlockAccount(
        FAUCET_ADDRESS,
        process.env.FAUCET_PASSPHRASE,
        10
      )
    }

    // Fund the authority address
    await RootChain.web3.eth.sendTransaction({
      from: FAUCET_ADDRESS,
      to: authorityAddress,
      value: process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 1e18
    })

    // Save the authority address to use later
    process.env.AUTHORITY_ADDRESS = authorityAddress
  } else {
    // If using an existing authority address check that its nonce is 0, abort if its not.
    const authorityNonce = RootChain.web3.eth.getTransactionCount(process.env.AUTHORITY_ADDRESS)
    if (authorityNonce !== 0) {
      throw new Error(`Authority address ${process.env.AUTHORITY_ADDRESS} nonce is not 0. Aborting...`)
    }
  }
}
