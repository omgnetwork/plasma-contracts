const { constants } = require('openzeppelin-test-helpers');
const { Position } = require('./positions.js');

const EMPTY_BYTES20 = '0x0000000000000000000000000000000000000000';

const EIP191_PREFIX = '0x1901';
const EIP712_DOMAIN_HASH = web3.utils.sha3('EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)');
const TX_TYPE_HASH = web3.utils.sha3('Transaction(uint256 txType,Input input0,Input input1,Input input2,Input input3,Output output0,Output output1,Output output2,Output output3,uint256 txData,bytes32 metadata)Input(uint256 blknum,uint256 txindex,uint256 oindex)Output(uint256 outputType,bytes20 outputGuard,address currency,uint256 amount)');
const INPUT_TYPE_HASH = web3.utils.sha3('Input(uint256 blknum,uint256 txindex,uint256 oindex)');
const OUTPUT_TYPE_HASH = web3.utils.sha3('Output(uint256 outputType,bytes20 outputGuard,address currency,uint256 amount)');
const SALT = '0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83';

const hashInput = (input) => {
    const utxoPos = new Position(input);

    return web3.utils.sha3(web3.eth.abi.encodeParameters([
        'bytes32', 'uint256', 'uint256', 'uint256',
    ], [
        INPUT_TYPE_HASH,
        utxoPos.blockNum,
        utxoPos.txIndex,
        utxoPos.outputIndex,
    ]));
};

const hashOutput = output => web3.utils.sha3(
    web3.eth.abi.encodeParameters([
        'bytes32', 'uint256', 'bytes20', 'address', 'uint256',
    ], [
        OUTPUT_TYPE_HASH,
        output.outputType,
        output.outputGuard,
        output.token,
        output.amount,
    ]),
);

const hashTx = (tx, verifyingContract) => {
    const domainSeparator = web3.utils.sha3(web3.eth.abi.encodeParameters([
        'bytes32', 'bytes32', 'bytes32', 'address', 'bytes32',
    ], [
        EIP712_DOMAIN_HASH,
        web3.utils.sha3('OMG Network'),
        web3.utils.sha3('1'),
        verifyingContract,
        SALT,
    ]));

    const inputs = tx.inputs.map(hashInput);
    const outputs = tx.outputs.map(hashOutput);

    const HASH_EMPTY_INPUT = hashInput(0);
    const HASH_EMPTY_OUTPUT = hashOutput({
        outputType: 0, outputGuard: EMPTY_BYTES20, token: constants.ZERO_ADDRESS, amount: 0,
    });
    const txHash = web3.utils.sha3(web3.eth.abi.encodeParameters([
        'bytes32', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32',
    ], [
        TX_TYPE_HASH,
        tx.transactionType,
        inputs.length > 0 ? inputs[0] : HASH_EMPTY_INPUT,
        inputs.length > 1 ? inputs[1] : HASH_EMPTY_INPUT,
        inputs.length > 2 ? inputs[2] : HASH_EMPTY_INPUT,
        inputs.length > 3 ? inputs[3] : HASH_EMPTY_INPUT,
        outputs.length > 0 ? outputs[0] : HASH_EMPTY_OUTPUT,
        outputs.length > 1 ? outputs[1] : HASH_EMPTY_OUTPUT,
        outputs.length > 2 ? outputs[2] : HASH_EMPTY_OUTPUT,
        outputs.length > 3 ? outputs[3] : HASH_EMPTY_OUTPUT,
        tx.txData,
        tx.metaData,
    ]));

    return web3.utils.soliditySha3(
        { t: 'bytes2', v: EIP191_PREFIX },
        { t: 'bytes32', v: domainSeparator },
        { t: 'bytes32', v: txHash },
    );
};

module.exports = { hashTx, hashInput, hashOutput };
