const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util');

function sign(msgHashHex, privateKey) {
    // remove prefix '0x'
    const message = (msgHashHex.length === 66) ? msgHashHex.substring(2) : msgHashHex;
    const tosign = Buffer.from(message, 'hex');
    const signed = ethUtil.ecsign(
        tosign,
        Buffer.from(privateKey.replace('0x', ''), 'hex'),
    );
    return sigUtil.concatSig(signed.v, signed.r, signed.s);
}

module.exports = { sign };
