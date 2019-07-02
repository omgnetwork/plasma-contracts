pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./IErc20DepositVerifier.sol";

contract Erc20DepositVerifier is IErc20DepositVerifier {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    function verify(DepositTx.Transaction memory _depositTx, address _owner) public pure {
        require(_depositTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(_depositTx.inputs.length == 1, "Deposit should have exactly one input");
        require(_depositTx.inputs[0] == bytes32(0), "Deposit input must be bytes32 of 0");

        require(_depositTx.outputs.length == 1, "Must have only one output");
        require(_depositTx.outputs[0].token != address(0), "Invalid output currency (ETH)");

        address depositorsAddress = address(uint160(uint256(_depositTx.outputs[0].outputGuard)));
        require(depositorsAddress == _owner, "Depositor's address does not match sender's address");
    }
}
