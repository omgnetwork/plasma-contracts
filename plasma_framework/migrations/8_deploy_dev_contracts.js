var Contract = artifacts.require("PaymentEip712LibMock");
var ERC20Mintable = artifacts.require("ERC20Mintable");
module.exports = function(deployer) {
  const ex_dev = process.env.EX_DEV || false;
    if (ex_dev) {
      deployer.deploy(Contract);
      deployer.deploy(ERC20Mintable);
    }
};