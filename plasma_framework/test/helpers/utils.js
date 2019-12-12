const { Position } = require('./positions.js');
const { CHILD_BLOCK_INTERVAL } = require('./constants.js');

async function spentOnGas(receipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);
    return web3.utils.toBN(tx.gasPrice).muln(receipt.gasUsed);
}

function buildOutputGuard(outputGuardPreimage) {
    const hashValue = web3.utils.soliditySha3(
        { t: 'bytes', v: outputGuardPreimage },
    );
    const rightMostBytes20 = hashValue.substring(hashValue.length - 40, hashValue.length);
    return `0x${rightMostBytes20}`;
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

function getOutputId(txBytes, utxoPos) {
    const inputUtxoPos = new Position(utxoPos);
    const outputId = isDeposit(inputUtxoPos.blockNum)
        ? computeDepositOutputId(txBytes, inputUtxoPos.outputIndex, inputUtxoPos.utxoPos)
        : computeNormalOutputId(txBytes, inputUtxoPos.outputIndex);
    return outputId;
}

function isDeposit(blockNum) {
    return blockNum % CHILD_BLOCK_INTERVAL !== 0;
}

function exitQueueKey(vaultId, token) {
    return web3.utils.soliditySha3(
        { t: 'uint256', v: vaultId },
        { t: 'address', v: token },
    );
}

module.exports = {
    spentOnGas,
    buildOutputGuard,
    computeDepositOutputId,
    computeNormalOutputId,
    getOutputId,
    isDeposit,
    exitQueueKey,
};
