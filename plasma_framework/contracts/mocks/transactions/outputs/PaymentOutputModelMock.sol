pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../../src/transactions/outputs/PaymentOutputModel.sol";
import "../../../src/utils/RLPReader.sol";

contract PaymentOutputModelMock {
    using PaymentOutputModel for PaymentOutputModel.Output;

    using RLPReader for bytes;

    function decode(bytes memory _output) public pure returns (PaymentOutputModel.Output memory) {
        PaymentOutputModel.Output memory output = PaymentOutputModel.decode(_output.toRlpItem());
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
