const { constants } = require('openzeppelin-test-helpers');

const { MerkleTree } = require('./merkle.js');
const { buildUtxoPos, UtxoPos } = require('./positions.js');
const {
    buildOutputGuard,
    computeNormalOutputId,
    computeDepositOutputId,
} = require('./utils.js');
const { PaymentTransactionOutput, PaymentTransaction, PlasmaDepositTransaction } = require('./transaction.js');
const { EMPTY_BYTES } = require('./constants.js');

const ETH = constants.ZERO_ADDRESS;
const CHILD_BLOCK_INTERVAL = 1000;
const OUTPUT_TYPE_ONE = 1;
const OUTPUT_TYPE_TWO = 2;
const IFE_TX_TYPE = 1;
const WITNESS_LENGTH_IN_BYTES = 65;
const IN_FLIGHT_TX_WITNESS_BYTES = web3.utils.bytesToHex('a'.repeat(WITNESS_LENGTH_IN_BYTES));
const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
const MERKLE_TREE_HEIGHT = 3;

function isDeposit(blockNum) {
    return blockNum % CHILD_BLOCK_INTERVAL !== 0;
}

/**
 * This returns a setup with the two inputs and one output.
 * First input would be of output type 1 and the second of output type 2.
 * All input txs and the in-flight exit tx would be same tx type: 1.
 * This assumes the tx type would be using MoreVP so the confirm sig provided in this setup would be EMPTY_BYTES.
 * (protocol setting is on the framework side)
 */
function buildValidIfeStartArgs(amount, [ifeOwner, inputOwner1, inputOwner2], blockNum1, blockNum2) {
    const inputTx1 = isDeposit(blockNum1)
        ? createDepositTransaction(inputOwner1, amount)
        : createInputTransaction([DUMMY_INPUT_1], inputOwner1, amount);

    const inputTx2 = isDeposit(blockNum2)
        ? createDepositTransaction(inputOwner2, amount)
        : createInputTransaction([DUMMY_INPUT_2], inputOwner2, amount);

    const inputTxs = [inputTx1, inputTx2];

    const inputUtxosPos = [buildUtxoPos(blockNum1, 0, 0), buildUtxoPos(blockNum2, 0, 0)];

    const inFlightTx = createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount);
    const {
        args,
        inputTxsBlockRoot1,
        inputTxsBlockRoot2,
    } = buildIfeStartArgs(inputTxs, [inputOwner1, inputOwner2], inputUtxosPos, inFlightTx);

    const argsDecoded = { inputTxs, inputUtxosPos, inFlightTx };

    return {
        args,
        argsDecoded,
        inputTxsBlockRoot1,
        inputTxsBlockRoot2,
    };
}

function buildIfeStartArgs([inputTx1, inputTx2], [inputOwner1, inputOwner2], inputUtxosPos, inFlightTx) {
    const rlpInputTx1 = inputTx1.rlpEncoded();
    const encodedInputTx1 = web3.utils.bytesToHex(rlpInputTx1);

    const rlpInputTx2 = inputTx2.rlpEncoded();
    const encodedInputTx2 = web3.utils.bytesToHex(rlpInputTx2);

    const inputTxs = [encodedInputTx1, encodedInputTx2];

    const merkleTree1 = new MerkleTree([encodedInputTx1], MERKLE_TREE_HEIGHT);
    const merkleTree2 = new MerkleTree([encodedInputTx2], MERKLE_TREE_HEIGHT);
    const inclusionProof1 = merkleTree1.getInclusionProof(encodedInputTx1);
    const inclusionProof2 = merkleTree2.getInclusionProof(encodedInputTx2);

    const inputTxsInclusionProofs = [inclusionProof1, inclusionProof2];

    const inputUtxosTypes = [OUTPUT_TYPE_ONE, OUTPUT_TYPE_TWO];

    const inFlightTxRaw = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

    const inputTxsConfirmSigs = [EMPTY_BYTES, EMPTY_BYTES];

    const inFlightTxWitnesses = [IN_FLIGHT_TX_WITNESS_BYTES, IN_FLIGHT_TX_WITNESS_BYTES];

    const inputSpendingConditionOptionalArgs = [EMPTY_BYTES, EMPTY_BYTES];

    const inputTxTypes = [IFE_TX_TYPE, IFE_TX_TYPE];

    const outputGuardPreimagesForInputs = [
        web3.utils.toHex(inputOwner1),
        web3.utils.toHex(inputOwner2),
    ];

    const args = {
        inFlightTx: inFlightTxRaw,
        inputTxs,
        inputTxTypes,
        inputUtxosPos,
        inputUtxosTypes,
        outputGuardPreimagesForInputs,
        inputTxsInclusionProofs,
        inputTxsConfirmSigs,
        inFlightTxWitnesses,
        inputSpendingConditionOptionalArgs,
    };

    const inputTxsBlockRoot1 = merkleTree1.root;
    const inputTxsBlockRoot2 = merkleTree2.root;

    return { args, inputTxsBlockRoot1, inputTxsBlockRoot2 };
}

function createInputTransaction(inputs, owner, amount, token = ETH) {
    const output = new PaymentTransactionOutput(amount, buildOutputGuard(OUTPUT_TYPE_ONE, owner), token);
    return new PaymentTransaction(IFE_TX_TYPE, inputs, [output]);
}

function createDepositTransaction(owner, amount, token = ETH) {
    const output = new PaymentTransactionOutput(amount, buildOutputGuard(OUTPUT_TYPE_ONE, owner), token);
    return new PlasmaDepositTransaction(output);
}

function createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount, token = ETH) {
    const inputs = createInputsForInFlightTx(inputTxs, inputUtxosPos);

    const output = new PaymentTransactionOutput(
        amount * inputTxs.length,
        ifeOwner,
        token,
    );

    return new PaymentTransaction(1, inputs, [output]);
}

function createInputsForInFlightTx(inputTxs, inputUtxosPos) {
    const inputs = [];
    for (let i = 0; i < inputTxs.length; i++) {
        const inputTx = web3.utils.bytesToHex(inputTxs[i].rlpEncoded());
        const outputId = getOutputId(inputTx, inputUtxosPos[i]);
        inputs.push(outputId);
    }
    return inputs;
}


function createInclusionProof(encodedTx, txUtxoPos) {
    const merkleTree = new MerkleTree([encodedTx], MERKLE_TREE_HEIGHT);
    const inclusionProof = merkleTree.getInclusionProof(encodedTx);

    return {
        inclusionProof,
        blockHash: merkleTree.root,
        blockNum: txUtxoPos.blockNum,
        blockTimestamp: 1000,
    };
}

function getOutputId(txBytes, utxoPos) {
    const inputUtxoPos = new UtxoPos(utxoPos);
    const outputId = isDeposit(inputUtxoPos.blockNum)
        ? computeDepositOutputId(txBytes, inputUtxoPos.outputIndex, inputUtxoPos.utxoPos)
        : computeNormalOutputId(txBytes, inputUtxoPos.outputIndex);
    return outputId;
}

module.exports = {
    isDeposit,
    buildValidIfeStartArgs,
    buildIfeStartArgs,
    createInputTransaction,
    createDepositTransaction,
    createInFlightTx,
    createInputsForInFlightTx,
    createInclusionProof,
    getOutputId,
};
