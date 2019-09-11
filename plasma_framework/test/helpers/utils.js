async function spentOnGas(receipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);
    return web3.utils.toBN(tx.gasPrice).muln(receipt.gasUsed);
}

function buildOutputGuard(outputType, outputGuardPreimage) {
    const hashValue = web3.utils.soliditySha3(
        { t: 'uint256', v: outputType },
        { t: 'bytes', v: outputGuardPreimage },
    );
    const rightMostBytes20 = hashValue.substring(hashValue.length - 40, hashValue.length);
    return `0x${rightMostBytes20}`;
}

function addressToOutputGuard(address) {
    return address;
}

function computeDepositOutputId(txBytes, outputIndex, utxoPos) {
    return web3.utils.soliditySha3(
        { t: 'bytes', v: txBytes },
        { t: 'uint256', v: outputIndex },
        { t: 'uint256', v: utxoPos },
    );
}

function computeNormalOutputId(txBytes, outputIndex) {
    return web3.utils.soliditySha3(
        { t: 'bytes', v: txBytes },
        { t: 'uint256', v: outputIndex },
    );
}

module.exports = {
    spentOnGas,
    buildOutputGuard,
    computeDepositOutputId,
    computeNormalOutputId,
    addressToOutputGuard,
};
