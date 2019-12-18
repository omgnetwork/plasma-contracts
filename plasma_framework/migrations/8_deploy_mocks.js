var Contract = artifacts.require("PaymentEip712LibMock");
module.exports = function(deployer) {
  const mocks = process.env.MOCKS || false;
    if (mocks) {
      deployer.deploy(Contract);
    }
};