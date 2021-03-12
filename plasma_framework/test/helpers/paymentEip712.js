const ethsig = require('eth-sig-util');
const { Position } = require('./positions.js');


const domainSpec = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'verifyingContract', type: 'address' },
    { name: 'salt', type: 'bytes32' },
];
const txSpec = [
    { name: 'txType', type: 'uint256' },
    { name: 'inputs', type: 'Input[]' },
    { name: 'outputs', type: 'Output[]' },
    { name: 'txData', type: 'uint256' },
    { name: 'metadata', type: 'bytes32' },
];

const inputSpec = [
    { name: 'blknum', type: 'uint256' },
    { name: 'txindex', type: 'uint256' },
    { name: 'oindex', type: 'uint256' },
];

const outputSpec = [
    { name: 'outputType', type: 'uint256' },
    { name: 'outputGuard', type: 'bytes20' },
    { name: 'currency', type: 'address' },
    { name: 'amount', type: 'uint256' },
];

const SALT = '0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83';
const domainData = {
    name: 'OMG Network',
    version: '1',
    verifyingContract: '',
    salt: SALT,
};

const data = {
    types: {
        EIP712Domain: domainSpec,
        Transaction: txSpec,
        Input: inputSpec,
        Output: outputSpec,
    },
    domain: domainData,
    primaryType: 'Transaction',
    message: '',
};

const toInputStruct = (input) => {
    const utxoPos = new Position(input);
    return {
        blknum: utxoPos.blockNum,
        txindex: utxoPos.txIndex,
        oindex: utxoPos.outputIndex,
    };
};

const toOutputStruct = output => ({
    outputType: output.outputType,
    outputGuard: output.outputGuard,
    currency: output.token,
    amount: output.amount,
});

const toTxStruct = tx => ({
    txType: tx.transactionType,
    inputs: tx.inputs.map(toInputStruct),
    outputs: tx.outputs.map(toOutputStruct),
    txData: tx.txData,
    metadata: tx.metaData,
});

const hashTx = (tx, verifyingContract) => {
    data.domain.verifyingContract = verifyingContract;
    data.message = toTxStruct(tx);
    return `0x${ethsig.TypedDataUtils.sign(data).toString('hex')}`;
};

module.exports = { hashTx };
