const rlp = require('rlp');
const { constants, expectRevert } = require('openzeppelin-test-helpers');

const PaymentOutputModelMock = artifacts.require("PaymentOutputModelMock");

const PaymentTransactionOutput = require("../../../helpers/transaction.js").PaymentTransactionOutput;

const OUTPUT_GUARD = "0x" + Array(64).fill(1).join("");

contract("PaymentOutputModel", () => {

    before(async () => {
        this.test = await PaymentOutputModelMock.new();
    });

    it("should decode output", async () => {
        const expected = new PaymentTransactionOutput(100, OUTPUT_GUARD, constants.ZERO_ADDRESS);
        const encoded = web3.utils.bytesToHex(rlp.encode(expected.formatForRlpEncoding()));

        const output = await this.test.decode(encoded);
        const actual = decodeOutput(output);

        expect(JSON.stringify(actual)).to.equal(JSON.stringify(expected));
    });
})

function decodeOutput(output) {
    const amount = parseInt(output.amount);
    const outputGuard = web3.eth.abi.decodeParameter('bytes32', output.outputGuard);
    const token = output.token;
    return new PaymentTransactionOutput(amount, outputGuard, token);
}

module.exports.decodeOutput = decodeOutput;
