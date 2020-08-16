const MultisigWalletWithDailyLimit = artifacts.require('MultiSigWalletWithDailyLimit.sol')
const MultisigWalletWithoutDailyLimit = artifacts.require('MultiSigWallet.sol')
const MultisigWalletFactory = artifacts.require('MultiSigWalletWithDailyLimitFactory.sol')
const fs = require('fs');
const path = require('path');

module.exports = async (deployer, [_deployerAddress]) => {
  const args = process.argv.slice();
  let accountsIndex = args.indexOf('--accounts');
  let confirmationsIndex = args.indexOf('--confirmations');
  let accounts = args[accountsIndex + 1].split(",");
  if (accountsIndex === -1 || confirmationsIndex === -1) {
    console.error('ABORTED. Use: --accounts 0xasdf,0xfdsa --confirmations 2');
    process.exit(1); 
  }
  else {
    console.log(`Accounts: ${accounts}`);
    console.log(`Confirmations: ${args[confirmationsIndex + 1]}`);
    deployer.deploy(MultisigWalletWithoutDailyLimit, accounts, args[confirmationsIndex + 1]).then(function() {
      const buildDir = path.resolve(__dirname, '../build');
      if (!fs.existsSync(buildDir)) {
          fs.mkdirSync(buildDir);
      }
      fs.writeFileSync(path.resolve(buildDir, 'multisig_instance'), `${MultisigWalletWithoutDailyLimit.address}`.toLowerCase());
    });
    console.log("Wallet deployed");
  }
}
