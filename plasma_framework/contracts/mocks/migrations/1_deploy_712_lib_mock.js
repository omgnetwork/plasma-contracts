var Contract = artifacts.require("PaymentEip712LibMock");

module.exports = function(deployer) {
  deployer.deploy(Contract);
};