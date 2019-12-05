/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */

const Migrations = artifacts.require('Migrations');

module.exports = function(deployer) {
  // Deploy the Migrations contract as our only task
  deployer.deploy(Migrations);
};
