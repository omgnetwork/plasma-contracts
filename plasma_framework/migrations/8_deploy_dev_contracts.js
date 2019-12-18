const PaymentEip712LibMock = artifacts.require('PaymentEip712LibMock');
const ERC20Mintable = artifacts.require('ERC20Mintable');

module.exports = function (deployer) {
    const exDev = process.env.EX_DEV || false;
    if (exDev) {
        deployer.deploy(PaymentEip712LibMock);
        deployer.deploy(ERC20Mintable);
    }
};
