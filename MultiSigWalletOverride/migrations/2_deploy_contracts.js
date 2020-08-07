const MultisigWalletWithDailyLimit = artifacts.require('MultiSigWalletWithDailyLimit.sol')
const MultisigWalletWithoutDailyLimit = artifacts.require('MultiSigWallet.sol')
const MultisigWalletFactory = artifacts.require('MultiSigWalletWithDailyLimitFactory.sol')
const fs = require('fs');
const path = require('path');

module.exports = async (deployer, [_deployerAddress]) => {
  const args = process.argv.slice();
  let accountsIndex = undefined;
  let confirmationsIndex = undefined;
  for (let j = 0; j < process.argv.length; j++) {
    
    if (process.argv[j] == '--accounts') {
      accountsIndex = j;
    }
    if (process.argv[j] == '--confirmations') {
      confirmationsIndex = j;
    }
  }
  console.log(`Accounts: ${args[accountsIndex + 1].split(",")}`);
  console.log(`Confirmations: ${args[confirmationsIndex + 1]}`);
  if (accountsIndex === undefined || confirmationsIndex == undefined) {
    console.log('ABORT. Use: --accounts 0xasdf,0xfdsa --confirmations 2');
    process.exit(1); 
  }
  else {
    deployer.deploy(MultisigWalletWithoutDailyLimit, args[accountsIndex + 1].split(","), args[confirmationsIndex + 1]).then(function() {
      const buildDir = path.resolve(__dirname, '../build');
      if (!fs.existsSync(buildDir)) {
          fs.mkdirSync(buildDir);
      }
      fs.writeFileSync(path.resolve(buildDir, 'multisig_instance'), `${MultisigWalletWithoutDailyLimit.address}`.toLowerCase());
    });
    console.log("Wallet deployed");
  }
}
