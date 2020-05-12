pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../exits/payment/PaymentExitGame.sol";
import "../framework/PlasmaFramework.sol";

contract liquidity {

   // some way to associate utxos to the contract with the sender, yes but how?
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

   // check if the user calling has transferred on omg network and exiting his own utxo
   // but if this contract owns the utxo the transfer must have been done
   // have to only check if the user is calling for his own utxo
    function startExitOnRootchainContract(uint256 _utxoPos, bytes memory _rlpOutputTx, bytes memory _outputTxInclusionProof) public payable {
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s;
        s.utxoPos = _utxoPos;
        s.rlpOutputTx = _rlpOutputTx;
        s.outputTxInclusionProof = _outputTxInclusionProof;
        peg.startStandardExit.value(msg.value)(s);
        // store the resultant exitid as a trait for the nft and map it to the msg.sender
    }

    // logic to store ethers after getting the withdrawl back
    // check if exitMap.exits[exitId] exists for the exitid assoicated with the token, if not burn the token and transfer
}
