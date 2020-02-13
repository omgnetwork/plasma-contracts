const PaymentEip712LibMock = artifacts.require('PaymentEip712LibMock');
const MerkleWrapper = artifacts.require('MerkleWrapper');
const ERC20Mintable = artifacts.require('ERC20Mintable');

module.exports = function (deployer) {
    const deployTestContracts = process.env.DEPLOY_TEST_CONTRACTS || false;
    if (deployTestContracts) {
        deployer.deploy(PaymentEip712LibMock);
        deployer.deploy(MerkleWrapper);
        deployer.deploy(ERC20Mintable);
    }
};
