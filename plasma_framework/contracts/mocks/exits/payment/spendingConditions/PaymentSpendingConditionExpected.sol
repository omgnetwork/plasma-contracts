pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../../../src/exits/payment/spendingConditions/IPaymentSpendingCondition.sol";

contract PaymentSpendingConditionExpected is IPaymentSpendingCondition {
    Expected private expected;
    
    struct Expected {
        bytes32 outputGuard;
        uint256 utxoPos;
        bytes32 outputId;
        bytes spendingTx;
        uint8 inputIndex;
        bytes witness;
    }

    function setExpected(Expected memory _expected) public {
        expected = _expected;
    }

    function verify(
        bytes32 _outputGuard,
        uint256 _utxoPos,
        bytes32 _outputId,
        bytes calldata _spendingTx,
        uint8 _inputIndex,
        bytes calldata _witness
    ) external view returns (bool) {
        require(expected.outputGuard == _outputGuard, "output guard not as expected");
        require(expected.utxoPos == _utxoPos, "utxo pos not as expected");
        require(expected.outputId == _outputId, "output id not as expected");
        require(compareBytes(expected.spendingTx, _spendingTx), "spending tx not as expected");
        require(expected.inputIndex == _inputIndex, "input index not as expected");
        require(compareBytes(expected.witness, _witness), "witness not as expected");

        return true;
    }

    function compareBytes(bytes memory a, bytes memory b) private pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
