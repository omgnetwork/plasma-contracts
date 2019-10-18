const { BN } = require('openzeppelin-test-helpers');

const { UtxoPos } = require('./positions.js');
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
    const inputUtxoPos = new UtxoPos(utxoPos);
    const outputId = isDeposit(inputUtxoPos.blockNum)
        ? computeDepositOutputId(txBytes, inputUtxoPos.outputIndex, inputUtxoPos.utxoPos)
        : computeNormalOutputId(txBytes, inputUtxoPos.outputIndex);
    return outputId;
}

function getStandardExitId(txBytes, utxoPos) {
    // remove '0x' prefix
    const outputId = getOutputId(txBytes, utxoPos).substring(2);
    return (new BN(outputId, 16)).shrn(256 - 159);
}

function getInFlightExitId(txBytes) {
    const txHash = web3.utils.soliditySha3({ t: 'bytes', v: txBytes });
    const txHashWithoutPrefix = txHash.substring(2); // remove '0x' prefix
    return (new BN(txHashWithoutPrefix, 16)).shrn(256 - 159).or((new BN(1)).shln(159));
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
    getStandardExitId,
    getInFlightExitId,
    getOutputId,
    isDeposit,
    exitQueueKey,
};
