pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/payment/PaymentExitGame.sol";
import "../../src/framework/PlasmaFramework.sol";
import "../../src/transactions/PaymentTransactionModel.sol";
import "../../src/utils/PosLib.sol";
import "../../src/framework/models/BlockModel.sol";
import "../../src/utils/Merkle.sol";
import "../../src/exits/payment/routers/PaymentStandardExitRouter.sol";

/**
 * @title Liquidity Contract
 * Implementation Doc - https://github.com/omisego/research/blob/master/plasma/simple_fast_withdrawals.md
*/
contract Liquidity {
    PaymentExitGame public paymentExitGame;

    PlasmaFramework public plasmaFramework;

    mapping(address => uint160[]) public userExitIds;
    mapping(uint160 => address) public exitIdtoUser;
    mapping(uint160 => uint256) public exitIdtoAmount;

    /**
     * @notice provide PlasmaFramework contract-address when deploying the contract
    */
    constructor(address plasmaFrameworkContract) public {
        plasmaFramework = PlasmaFramework(plasmaFrameworkContract);
        paymentExitGame = PaymentExitGame(plasmaFramework.exitGames(1));
    }

    /**
     * @dev Call this func to start the exit on Rootchain contract
     * @param utxoPosToExit position of the output which the contract has to exit
     * @param rlpOutputTxToContract RLP-encoded transaction that creates the output for the contract
     * @param outputTxToContractInclusionProof Second Transaction's inclusion proof
     * @param rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param inputCreationTxInclusionProof First transactions inclusion proofs
     * @param utxoPosInput position of the output that created the inputs for second transaction
    */
    function startExit(
        uint256 utxoPosToExit,
        bytes memory rlpOutputTxToContract,
        bytes memory outputTxToContractInclusionProof,
        bytes memory rlpInputCreationTx,
        bytes memory inputCreationTxInclusionProof,
        uint256 utxoPosInput
    ) public payable {

        PosLib.Position memory utxoDecoded = PosLib.decode(utxoPosInput);

        verifyOwnership(rlpInputCreationTx, utxoDecoded);

        PaymentTransactionModel.Transaction memory decodedSecondTx
        = PaymentTransactionModel.decode(rlpOutputTxToContract);
        require(
            decodedSecondTx.inputs[0] == bytes32(utxoPosInput),
            "Wrong utxoPosInput provided"
        );

        require(verifyTxValidity(
            utxoDecoded,
            rlpInputCreationTx,
            inputCreationTxInclusionProof
        ),
        "Provided Transaction isn't finalized or doesn't exist"
        );

        require(runExit(
            utxoPosToExit,
            rlpOutputTxToContract,
            outputTxToContractInclusionProof
        ),
        "Couldn't start the exit"
        );

        // store the resultant exitid as a trait for the nft and map it to the msg.sender
        uint160 exitId = paymentExitGame.getStandardExitId(false, rlpOutputTxToContract, utxoPosToExit);
        userExitIds[msg.sender].push(exitId);
        exitIdtoUser[exitId] = msg.sender;

        // associate the amount exiting to the exitId

        FungibleTokenOutputModel.Output memory outputFromSecondTransaction
        = decodedSecondTx.outputs[0];
        uint256 amount = outputFromSecondTransaction.amount;
        exitIdtoAmount[exitId] = amount;
    }

    /**
     * @notice Check if the person calling is the same person who created the tx to the contract
     * @param rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param utxoDecoded decoded position of the output that created the inputs for second transaction
    */
    function verifyOwnership(
        bytes memory rlpInputCreationTx,
        PosLib.Position memory utxoDecoded
    ) private {

        PaymentTransactionModel.Transaction memory decodedFirstTx
        = PaymentTransactionModel.decode(rlpInputCreationTx);
        uint16 firstTransactionOutputIndex = utxoDecoded.outputIndex;

        FungibleTokenOutputModel.Output memory outputFromFirstTransaction
        = decodedFirstTx.outputs[firstTransactionOutputIndex];
        address ownerFirstTxOutput = PaymentTransactionModel.getOutputOwner(outputFromFirstTransaction);
        require(
            ownerFirstTxOutput == msg.sender,
            "Was not called by the first Tx owner"
        );
    }

    /**
     * @notice Verify the First Tx provided is valid
     * @param utxoDecoded decoded position of the output that created the inputs for second transaction
     * @param rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param inputCreationTxInclusionProof First transactions inclusion proofs
    */
    function verifyTxValidity(
        PosLib.Position memory utxoDecoded,
        bytes memory rlpInputCreationTx,
        bytes memory inputCreationTxInclusionProof
    ) private returns (bool) {
        utxoDecoded.outputIndex = 0;
        (bytes32 root, ) = plasmaFramework.blocks(utxoDecoded.blockNum);
        require(root != bytes32(""), "Failed to get root of the block");
        return Merkle.checkMembership(
            rlpInputCreationTx,
            utxoDecoded.txIndex,
            root,
            inputCreationTxInclusionProof
        );
    }

    /**
     * @notice func that calls omg-contracts to start the exit
     * @param utxoPosToExit position of the output which the contract has to exit
     * @param rlpOutputTxToContract RLP-encoded transaction that creates the output for the contract
     * @param outputTxToContractInclusionProof Second Transaction's inclusion proof
    */
    function runExit(
        uint256 utxoPosToExit,
        bytes memory rlpOutputTxToContract,
        bytes memory outputTxToContractInclusionProof
    ) private returns (bool) {
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s = PaymentStandardExitRouterArgs.StartStandardExitArgs({
            utxoPos: utxoPosToExit,
            rlpOutputTx: rlpOutputTxToContract,
            outputTxInclusionProof: outputTxToContractInclusionProof
        });
        paymentExitGame.startStandardExit.value(msg.value)(s);
        return true;
    }

    /**
     * @dev Get Amount from contract after exit is processed - (to be updated)
     * @param exitId The exit id
    */
    function getWithdrawal(uint160 exitId) public {
        require(
            exitIdtoUser[exitId] == msg.sender,
            "Only the exitId owner can get the withdrawal"
        );
        uint160[] memory exitIdList = new uint160[](1);
        exitIdList[0] = exitId;
        PaymentExitDataModel.StandardExit[] memory exits = paymentExitGame.standardExits(
            exitIdList
        );
        if (exits[0].utxoPos == 0) {
            exitIdtoUser[exitId] = 0x0000000000000000000000000000000000000000;
            msg.sender.transfer(exitIdtoAmount[exitId]);
        } else {
            revert("Not processed exit");
        }
    }

    /**
     * @dev for the contract to receive funds after the exit has been processed
    */
    function() external payable {

    }
}
