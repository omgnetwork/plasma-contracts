var PriorityQueueLib = artifacts.require('./PriorityQueueLib.sol')
var PriorityQueueFactory = artifacts.require('./PriorityQueueFactory.sol')
var RootChain = artifacts.require('./RootChain.sol')

module.exports = async function (deployer, network, accounts) {
  // If no DEPLOYER_ADDRESS is set, default to using accounts[0]
  const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || accounts[0]

  // Unlock the deployer account if not using Infura
  // As infura doesn't support eth_unlockAccount
  if (process.env.DEPLOYER_PASSPHRASE &&
     !process.env.AUTHORITY_PRIVATEKEY && 
     !process.env.DEPLOYER_PRIVATEKEY
  ) {
    await RootChain.web3.eth.personal.unlockAccount(
      DEPLOYER_ADDRESS,
      process.env.DEPLOYER_PASSPHRASE,
      10
    )
  }

  await deployer.deploy(PriorityQueueLib)

  await deployer.link(PriorityQueueLib, PriorityQueueFactory)
  await deployer.deploy(PriorityQueueFactory)

  await deployer.link(PriorityQueueFactory, RootChain)
  return deployer.deploy(RootChain)
}
