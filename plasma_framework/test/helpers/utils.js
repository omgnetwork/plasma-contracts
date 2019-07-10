async function spentOnGas(receipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);
    return web3.utils.toBN(tx.gasPrice).muln(receipt.gasUsed);
}

function buildOutputGuard(outputType, outputGuardData) {
    const hashValue = web3.utils.soliditySha3(
        { t: 'uint256', v: outputType },
        { t: 'bytes', v: outputGuardData },
    );
    const rightMostBytes20 = hashValue.substring(hashValue.length - 40, hashValue.length);
    const paddingZeros = Array(24).fill(0).join('');
    return `0x${paddingZeros}${rightMostBytes20}`;
}

function computeOutputId(isDeposit, txBytes, outputIndex, utxoPos) {
    if (isDeposit) {
        return computeDepositOutputId(txBytes, outputIndex, utxoPos);
    }
    return computeNormalOutputId(txBytes, outputIndex);
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

module.exports.spentOnGas = spentOnGas;
module.exports.buildOutputGuard = buildOutputGuard;
module.exports.computeOutputId = computeOutputId;
module.exports.computeDepositOutputId = computeDepositOutputId;
module.exports.computeNormalOutputId = computeNormalOutputId;
