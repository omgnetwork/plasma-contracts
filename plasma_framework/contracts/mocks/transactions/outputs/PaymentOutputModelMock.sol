pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/transactions/outputs/PaymentOutputModel.sol";
import "../../../src/utils/RLP.sol";

contract PaymentOutputModelMock {

    using RLP for bytes;

    function decode(bytes memory _output) public pure returns (PaymentOutputModel.Output memory) {
        PaymentOutputModel.Output memory output = PaymentOutputModel.decode(_output.toRLPItem());
        return output;
    }

}
