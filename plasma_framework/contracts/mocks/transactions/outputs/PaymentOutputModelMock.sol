pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../src/transactions/outputs/PaymentOutputModel.sol";
import "../../../src/utils/RLP.sol";

contract PaymentOutputModelMock {
    using PaymentOutputModel for PaymentOutputModel.Output;

    using RLP for bytes;

    function decode(bytes memory _output) public pure returns (PaymentOutputModel.Output memory) {
        PaymentOutputModel.Output memory output = PaymentOutputModel.decode(_output.toRLPItem());
        return output;
    }

    function owner(uint256 _outputType, uint256 _amount, address _owner, address _token) public pure returns (address payable) {
        PaymentOutputModel.Output memory output = PaymentOutputModel.Output({
            outputType: _outputType,
            amount: _amount,
            outputGuard: bytes20(uint160(_owner)),
            token: _token
        });
        return output.owner();
    }
}
