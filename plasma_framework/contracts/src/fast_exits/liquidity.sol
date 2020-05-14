pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../exits/payment/PaymentExitGame.sol";
import "../framework/PlasmaFramework.sol";
import "../transactions/PaymentTransactionModel.sol";
import "../utils/PosLib.sol";
import "../framework/models/BlockModel.sol";
import "../utils/Merkle.sol";

contract liquidity {

   // some way to associate utxos to the contract with the sender, yes but how?
   // do we need a vault? we could do with storing funds in the contract itslef
   // change to take in plasma framework contract address
    PaymentExitGame peg;
    address targetPaymentExitGameContract;

    PlasmaFramework pf;
    address targetPlasmaFrameworkContract;

    mapping (address => uint160[]) userExitIds;

    constructor(address _plasmaFrameworkContract) public {
        targetPlasmaFrameworkContract = _plasmaFrameworkContract;
        pf = PlasmaFramework(targetPlasmaFrameworkContract);
        targetPaymentExitGameContract = pf.exitGames(1);
        peg = PaymentExitGame(targetPaymentExitGameContract);
    }

    function getCurrentBondSize() public view returns (uint128) {
        return peg.startStandardExitBondSize();
    }

    function getOutputIndex(uint256 _utxoPos) internal pure returns (uint16) {
        uint256 TX_OFFSET = 10000;
        return uint16(_utxoPos % TX_OFFSET);
    }

   // check if the user calling has transferred on omg network and exiting his own utxo
   // but if this contract owns the utxo the transfer must have been done
   // have to only check if the user is calling for his own utxo
    function startExitOnRootchainContract(
        uint256 _utxoPosToExit,
        bytes memory _rlpOutputTxToContract,
        bytes memory _outputTxToContractInclusionProof,
        bytes memory _rlpInputCreationTx,
        bytes memory _inputCreationTxInclusionProof,
        uint256 _utxoPosInput
        )

     public payable {
         // check if the msg.sender is the owner of the first utxo provided
        PaymentTransactionModel.Transaction memory decodedFirstTx = PaymentTransactionModel.decode(_rlpInputCreationTx);
        uint16 firstTransactionOutputIndex = getOutputIndex(_utxoPosInput);
        FungibleTokenOutputModel.Output memory outputFromFirstTransaction = decodedFirstTx.outputs[firstTransactionOutputIndex];
        address ownerFirstTxOutput = address(uint160(outputFromFirstTransaction.outputGuard));
        require (ownerFirstTxOutput == msg.sender, "First Tx Provided was not called by sender");

    
        PaymentTransactionModel.Transaction memory decodedSecondTx = PaymentTransactionModel.decode(_rlpOutputTxToContract);
        require(
            decodedSecondTx.inputs[0] == bytes32(_utxoPosInput),
            "Wrong utxoPosInput provided"
        );

        PosLib.Position memory utxoDecoded = PosLib.decode(_utxoPosInput);
        utxoDecoded.outputIndex = 0;
        (bytes32 _root,) = pf.blocks(utxoDecoded.blockNum);
        bytes32 root = _root;
        require(root != bytes32(""),"Failed to get root of the block");
        bool txExists = Merkle.checkMembership(_rlpInputCreationTx, utxoDecoded.txIndex, root, _inputCreationTxInclusionProof);
        require(txExists, "Provided Transaction isn't finalized or doesn't exist");

        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s;
        s.utxoPos = _utxoPosToExit;
        s.rlpOutputTx = _rlpOutputTxToContract;
        s.outputTxInclusionProof = _outputTxToContractInclusionProof;
        peg.startStandardExit.value(msg.value)(s);
        // store the resultant exitid as a trait for the nft and map it to the msg.sender
        uint160 _exitId = getStandardExitId(false, _rlpOutputTxToContract, _utxoPosToExit);
        userExitIds[msg.sender].push(_exitId);
    }

    // logic to store ethers after getting the withdrawl back
    // check if exitMap.exits[exitId] exists for the exitid assoicated with the token, if not burn the token and transfer
}
