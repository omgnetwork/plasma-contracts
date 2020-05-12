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

    function startExitOnRootchainContract(uint256 _utxoPos, bytes memory _rlpOutputTx, bytes memory _outputTxInclusionProof) public {
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s;
        s.utxoPos = _utxoPos;
        s.rlpOutputTx = _rlpOutputTx;
        s.outputTxInclusionProof = _outputTxInclusionProof;
        // also pay the contract
        peg.startStandardExit(s);
    }

    // logic to store after getting the withdrawl back

}
