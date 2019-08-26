require('dotenv').config()
const RootChain = artifacts.require('./RootChain.sol')


module.exports = async function (deployer, network, accounts) {
  // Get the deployer address
  global.deployerAddress = (process.env.DEPLOYER_PASSPHRASE) ?
    await RootChain.web3.eth.personal.newAccount(process.env.DEPLOYER_PASSPHRASE) :
    (process.env.DEPLOYER_ADDRESS || accounts[0])

  // Get the authority address
  global.authorityAddress = (process.env.AUTHORITY_PASSPHRASE) ?
    await RootChain.web3.eth.personal.newAccount(process.env.AUTHORITY_PASSPHRASE) :
    (process.env.AUTHORITY_ADDRESS || accounts[1])

  // Throws an error if the nonce of the authority address is > 0
  const throwIfAuthorityNonceGtZero = async () => {
    // If using an existing authority address, its nonce must be 0. Abort if it's not.
    const authorityNonce = await RootChain.web3.eth.getTransactionCount(global.authorityAddress)
    if (authorityNonce !== 0) {
      throw new Error(`Authority address ${global.authorityAddress} nonce is not 0. Aborting...`)
    }
  }

  // Funds the authority account
  const autoFundAuthorityAccount = async () => {
    // Check if authorithy address has enough funds, if not auto fund it
    const authorithyWeiCount = await RootChain.web3.eth.getBalance(global.authorityAddress)

    // Fund authority if it has 0 funds
    if (parseInt(authorithyWeiCount) === 0) {
      // Funds authority address
      console.log(`Funding authority address ${global.authorityAddress}`)
      await RootChain.web3.eth.sendTransaction({
        from: global.deployerAddress,
        to: global.authorityAddress,
        value: process.env.AUTHORITY_ADDRESS_INITIAL_AMOUNT || 1e18
      })
      console.log('Successfully funded authority address.')
    }
  }

  // If user wants to deploy via infura
  if (process.env.AUTHORITY_PRIVATEKEY && process.env.DEPLOYER_PRIVATEKEY) {
    await throwIfAuthorityNonceGtZero()
    await autoFundAuthorityAccount()
  } else if (process.env.USE_EXISTING_AUTHORITY_ADDRESS) {
    await throwIfAuthorityNonceGtZero()
  } else {
    // Check that AUTHORITY_PASSPHRASE is set
    if (!process.env.AUTHORITY_PASSPHRASE) {
      throw new Error("Can't create new Authority address without AUTHORITY_PASSPHRASE")
    }

    // Unlock the deployer account if necessary
    if (process.env.DEPLOYER_PASSPHRASE) {
      await RootChain.web3.eth.personal.unlockAccount(
        global.deployerAddress,
        process.env.DEPLOYER_PASSPHRASE,
        10
      )
    }

    // Fund the authority address
    await autoFundAuthorityAccount()
  }
}
