const Web3 = require("web3");
const fs = require('fs');
const path = require('path');

(async () => {
let web3;
var provider = new Web3.providers.HttpProvider(process.env.REMOTE_URL || 'http://127.0.0.1:8545');
web3 = new Web3(provider);
const lastBlockNumber = await web3.eth.getBlockNumber();
abi = JSON.parse(fs.readFileSync('MultiSigWalletAbi.json', 'utf8'));
const buildDir = path.resolve(__dirname, '../../MultiSigWallet/build/multisig_instance');
const gnosisMultisigAddress = fs.readFileSync(buildDir, 'utf8');
let multiSigWallet = new web3.eth.Contract(abi, gnosisMultisigAddress);
//console.log(multiSigWallet);
//console.log(multiSigWallet.methods.confirmations());
// console.log(multiSigWallet);
//console.log(await multiSigWallet.methods.confirmations().call());
// console.log(await multiSigWallet.methods.getTransactionCount(true, false).call());
// console.log(await multiSigWallet.methods.getTransactionCount(false, true).call());
// console.log(await multiSigWallet.methods.getTransactionCount(false, false).call());
// console.log(await multiSigWallet.methods.getTransactionCount(true, true).call());
// console.log(await multiSigWallet.methods.getOwners().call());
// console.log(await multiSigWallet.methods.transactionCount().call());
// console.log(await multiSigWallet.methods.isConfirmed(0).call());
// let transactionIds = await multiSigWallet.methods.getTransactionIds(0, 8, true, false).call();
// https://tryroll.com/beware-of-transaction-failures-in-old-gnosis-multisig/
//console.log(await multiSigWallet.methods.executeTransaction(0).send({from: '0xa508dD875f10C33C52a8abb20E16fc68E981F186', gas: 6000000}));
//console.log(await multiSigWallet.methods.confirmTransaction(1).send({from: '0xa508dD875f10C33C52a8abb20E16fc68E981F186', gas: 3000000}));
//console.log(await multiSigWallet.methods.isConfirmed(1).call());
//console.log(await multiSigWallet.methods.executeTransaction(1).send({from: '0xa508dD875f10C33C52a8abb20E16fc68E981F186', gas: 3000000}));
// for (var ii = 0; ii < transactionIds.length; ii++) {
//   //console.log(await multiSigWallet.methods.confirmTransaction(ii).send({from: '0xa508dD875f10C33C52a8abb20E16fc68E981F186', gas: 3000000}));
// }
//console.log(await web3.eth.sendTransaction({to: gnosisMultisigAddress, from: '0xa508dD875f10C33C52a8abb20E16fc68E981F186', value: web3.utils.toWei("50", "ether")}));
console.log(await web3.eth.getBalance(gnosisMultisigAddress));
console.log(await multiSigWallet.methods.executeTransaction(1).send({from: '0xa508dD875f10C33C52a8abb20E16fc68E981F186', gas: 6000000}));
})();