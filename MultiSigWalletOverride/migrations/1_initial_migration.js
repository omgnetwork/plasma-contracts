const Migrations = artifacts.require("./Migrations.sol")

module.exports = async (deployer, _, [deployerAddress]) => {
  // Deploy migrations
  await deployer.deploy(Migrations);
};
