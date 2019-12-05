var Contract = artifacts.require("PaymentEip712LibMock");

module.exports = function(deployer) {
  console.log(`Deploying PaymentEip712LibMock`);
  deployer.deploy(Contract);
};