async function spentOnGas(receipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);
    return web3.utils.toBN(tx.gasPrice).muln(receipt.gasUsed);
}

module.exports.spentOnGas = spentOnGas;
