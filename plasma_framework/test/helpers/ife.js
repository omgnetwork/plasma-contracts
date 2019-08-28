const { constants } = require('openzeppelin-test-helpers');

const { MerkleTree } = require('./merkle.js');
const { buildUtxoPos, UtxoPos } = require('./positions.js');
const { addressToOutputGuard, computeNormalOutputId } = require('./utils.js');
const { PaymentTransactionOutput, PaymentTransaction, PlasmaDepositTransaction } = require('./transaction.js');

const ETH = constants.ZERO_ADDRESS;
const CHILD_BLOCK_INTERVAL = 1000;
const OUTPUT_TYPE_ZERO = 0;
const IFE_TX_TYPE = 1;
const WITNESS_LENGTH_IN_BYTES = 65;
const IN_FLIGHT_TX_WITNESS_BYTES = web3.utils.bytesToHex('a'.repeat(WITNESS_LENGTH_IN_BYTES));
const BLOCK_NUMBER = 1000;
const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
const MERKLE_TREE_HEIGHT = 3;
const AMOUNT = 10;

function isDeposit(blockNum) {
    return blockNum % CHILD_BLOCK_INTERVAL !== 0;
}

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
    } = buildIfeStartArgs(inputTxs, inputUtxosPos, inFlightTx);

    const argsDecoded = { inputTxs, inputUtxosPos, inFlightTx };

    return {
        args,
        argsDecoded,
        inputTxsBlockRoot1,
        inputTxsBlockRoot2,
    };
}

function buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx) {
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

    const inputUtxosTypes = [OUTPUT_TYPE_ZERO, OUTPUT_TYPE_ZERO];

    const inFlightTxRaw = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

    const inFlightTxWitnesses = [IN_FLIGHT_TX_WITNESS_BYTES, IN_FLIGHT_TX_WITNESS_BYTES];

    const args = {
        inFlightTx: inFlightTxRaw,
        inputTxs,
        inputUtxosPos,
        inputUtxosTypes,
        inputTxsInclusionProofs,
        inFlightTxWitnesses,
    };

    const inputTxsBlockRoot1 = merkleTree1.root;
    const inputTxsBlockRoot2 = merkleTree2.root;

    return { args, inputTxsBlockRoot1, inputTxsBlockRoot2 };
}

function createInputTransaction(inputs, owner, amount, token = ETH) {
    const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), token);
    return new PaymentTransaction(IFE_TX_TYPE, inputs, [output]);
}

function createDepositTransaction(owner, amount, token = ETH) {
    const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), token);
    return new PlasmaDepositTransaction(output);
}

function createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount, token = ETH) {
    const inputs = createInputsForInFlightTx(inputTxs, inputUtxosPos);

    const output = new PaymentTransactionOutput(
        amount * inputTxs.length,
        addressToOutputGuard(ifeOwner),
        token,
    );

    return new PaymentTransaction(1, inputs, [output]);
}

function createInputsForInFlightTx(inputTxs, inputUtxosPos) {
    const inputs = [];
    for (let i = 0; i < inputTxs.length; i++) {
        const inputUtxoPos = new UtxoPos(inputUtxosPos[i]);
        const inputTx = web3.utils.bytesToHex(inputTxs[i].rlpEncoded());
        const outputId = computeNormalOutputId(inputTx, inputUtxoPos.outputIndex);
        inputs.push(outputId);
    }
    return inputs;
}

function createCompetitorTransaction(inputs, owner) {
    const utxoPos = new UtxoPos(inputs[0]);
    const competingTx = createInputTransaction(inputs, owner, AMOUNT);
    const competingTxPos = new UtxoPos(buildUtxoPos(utxoPos.blockNum + CHILD_BLOCK_INTERVAL, 0, 0));

    return {
        competingTx: web3.utils.bytesToHex(competingTx.rlpEncoded()),
        decodedCompetingTx: competingTx,
        competingTxPos,
    };
}

function createInclusionProof(encodedTx, txUtxoPos) {
    const merkleTree = new MerkleTree([encodedTx], MERKLE_TREE_HEIGHT);
    const competingTxInclusionProof = merkleTree.getInclusionProof(encodedTx);

    return {
        competingTxInclusionProof,
        blockHash: merkleTree.root,
        blockNum: txUtxoPos.blockNum,
        blockTimestamp: 1000,
    };
}

function buildValidNoncanonicalChallengeArgs(decodedIfeTx, competitorOwner) {
    const utxoPos = new UtxoPos(buildUtxoPos(BLOCK_NUMBER, 2, 2));
    const { competingTx, decodedCompetingTx, competingTxPos } = createCompetitorTransaction(
        [utxoPos.utxoPos, decodedIfeTx.inputs[0]], competitorOwner,
    );

    const {
        competingTxInclusionProof, blockHash, blockNum, blockTimestamp,
    } = createInclusionProof(
        competingTx, competingTxPos,
    );

    const competingTxWitness = addressToOutputGuard(competitorOwner);

    return {
        args: {
            inFlightTx: web3.utils.bytesToHex(decodedIfeTx.rlpEncoded()),
            inFlightTxInputIndex: 0,
            competingTx,
            competingTxInputIndex: 1,
            competingTxInputOutputType: OUTPUT_TYPE_ZERO,
            competingTxPos: competingTxPos.utxoPos,
            competingTxInclusionProof,
            competingTxWitness,
        },
        block: {
            blockHash, blockNum, blockTimestamp,
        },
        decodedCompetingTx,
    };
}

module.exports = {
    isDeposit,
    buildValidIfeStartArgs,
    buildValidNoncanonicalChallengeArgs,
    buildIfeStartArgs,
    createInputTransaction,
    createDepositTransaction,
    createInFlightTx,
    createInputsForInFlightTx,
    createCompetitorTransaction,
    createInclusionProof,
};
