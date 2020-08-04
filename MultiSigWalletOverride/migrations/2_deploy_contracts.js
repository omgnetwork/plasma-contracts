const MultisigWalletWithDailyLimit = artifacts.require('MultiSigWalletWithDailyLimit.sol')
const MultisigWalletWithoutDailyLimit = artifacts.require('MultiSigWallet.sol')
const MultiSigWallet = artifacts.require('MultiSigWallet')
// const deployMultisig = (owners, confirmations) => {
//   return MultiSigWallet.new(owners, confirmations)
// }
const MultisigWalletFactory = artifacts.require('MultiSigWalletWithDailyLimitFactory.sol')
const fs = require('fs');
const path = require('path');

module.exports = async (deployer) => {
  const args = process.argv.slice()
  if (process.env.DEPLOY_FACTORY){
    deployer.deploy(MultisigWalletFactory)
    console.log("Factory with Daily Limit deployed")
  } else if (args.length < 5) {
    console.error("Multisig with daily limit requires to pass owner " +
      "list, required confirmations and daily limit")
  } else if (args.length < 6) {
    console.log("Deploying MultisigWalletWithoutDailyLimit");
    console.log(`Accounts to Multisig Wallet Without Daily Limit ${args[3].split(",")}`);
    console.log(`Number of required confirmations ${args[4]}`);
    await deployer.deploy(MultiSigWallet, args[3].split(","), args[4]);
    const multiSigWallet = await MultiSigWallet.deployed();
    const buildDir = path.resolve(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }
    fs.writeFileSync(path.resolve(buildDir, 'multisig_instance'), `${multiSigWallet.address}`.toLowerCase());
  } else {
    deployer.deploy(MultisigWalletWithDailyLimit, args[3].split(","), args[4], args[5])
    console.log("Wallet with Daily Limit deployed")
  }
}