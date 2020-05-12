pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../exits/payment/PaymentExitGame.sol";


contract liquidity {

   // some way to associate deposits to the contract with the sender
   // do we need a vault?
   // change to take in plasma framework contract address
    PaymentExitGame peg;
    address targetPaymentExitGameContract;

    constructor(address _paymentExitGameContract) public {
        targetPaymentExitGameContract = _paymentExitGameContract;
        peg = PaymentExitGame(targetPaymentExitGameContract);
    }

    function getCurrentBondSize() public view returns (uint128) {
        return peg.startStandardExitBondSize();
    }

   // check if the user calling has deposited and exiting his own utxo
    function startExitOnRootchainContract(uint256 _utxoPos, bytes memory _rlpOutputTx, bytes memory _outputTxInclusionProof) public payable {
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s;
        s.utxoPos = _utxoPos;
        s.rlpOutputTx = _rlpOutputTx;
        s.outputTxInclusionProof = _outputTxInclusionProof;
        peg.startStandardExit.value(msg.value)(s);
    }

    // logic to store ethers after getting the withdrawl back

}
