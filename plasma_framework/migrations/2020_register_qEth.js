const Quasar = artifacts.require('Quasar');
const QToken = artifacts.require('QToken');

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const deployQuasar = process.env.DEPLOY_QUASAR || false;
    if (deployQuasar) {
        const quasar = await Quasar.deployed();
        const qEth = await deployer.deploy(QToken, 'Quasar Ether', 'qETH', 18, quasar.address);
        const quasarFee = process.env.QETH_FEE;

        await quasar.registerQToken(
            '0x0000000000000000000000000000000000000000', qEth.address, quasarFee,
        );
    }
};
