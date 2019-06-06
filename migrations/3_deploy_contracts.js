var PriorityQueueLib = artifacts.require('./PriorityQueueLib.sol')
var PriorityQueueFactory = artifacts.require('./PriorityQueueFactory.sol')
var RootChain = artifacts.require('./RootChain.sol')

module.exports = function (deployer, network, accounts) {
  deployer.deploy(PriorityQueueLib)

  deployer.link(PriorityQueueLib, PriorityQueueFactory)
  deployer.deploy(PriorityQueueFactory)

  deployer.link(PriorityQueueFactory, RootChain)
  deployer.deploy(RootChain)
}
