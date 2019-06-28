const rlp = require('rlp');
const { constants, expectRevert } = require('openzeppelin-test-helpers');

const PaymentTransactionModelMock = artifacts.require("PaymentTransactionModelMock");

const { PaymentTransaction, PaymentTransactionOutput } = require("../../helpers/transaction.js");

const OUTPUT_GUARD = "0x" + Array(64).fill(1).join("");
const EMPTY_BYTES32 = "0x" + Array(64).fill(0).join("");

contract("PaymentTransactionModel", () => {

    before(async () => {
        this.test = await PaymentTransactionModelMock.new();
    });

    it("should decode payment transaction", async () => {
        const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
        const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [output, output], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        const actual = await this.test.decode(encoded);
        const decoded = new PaymentTransaction(
            parseInt(actual.txType),
            parseInputs(actual.inputs),
            parseOutputs(actual.outputs),
            actual.metaData,
        );

        expect(JSON.stringify(decoded)).to.equal(JSON.stringify(transaction));
    });

    it("should fail when decoding transaction without inputs", async () => {
        const output = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
        const transaction = new PaymentTransaction(1, [], [output], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        await expectRevert(
            this.test.decode(encoded),
            "Transaction must have inputs"
        );
    });

    it("should fail when decoding transaction without outputs", async () => {
        const transaction = new PaymentTransaction(1, [EMPTY_BYTES32], [], EMPTY_BYTES32);
        const encoded = web3.utils.bytesToHex(transaction.rlpEncoded());

        await expectRevert(
            this.test.decode(encoded),
            "Transaction must have outputs"
        );
    });

    it("should fail when decoding invalid transaction", async () => {
        const encoded = web3.utils.bytesToHex(rlp.encode([0, 0]));

        await expectRevert(
            this.test.decode(encoded),
            "Invalid encoding of transaction"
        );
    });
})

function parseInputs(inputs) {
    return inputs.map(input => web3.eth.abi.decodeParameter('bytes32', input));
}

function parseOutputs(outputs) {
    return outputs.map(PaymentTransactionOutput.parseFromContractOutput);
}
