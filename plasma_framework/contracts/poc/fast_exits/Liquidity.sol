pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/exits/payment/PaymentExitGame.sol";
import "../../src/framework/PlasmaFramework.sol";
import "../../src/transactions/PaymentTransactionModel.sol";
import "../../src/utils/PosLib.sol";
import "../../src/framework/models/BlockModel.sol";
import "../../src/utils/Merkle.sol";
import "../../src/exits/payment/routers/PaymentStandardExitRouter.sol";
import "../../src/exits/utils/ExitBounty.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title Liquidity Contract
 * Implementation Doc - https://github.com/omisego/research/blob/master/plasma/simple_fast_withdrawals.md
*/
contract Liquidity is ERC721Full {
    using SafeERC20 for IERC20;

    PaymentExitGame public paymentExitGame;

    PlasmaFramework public plasmaFramework;

    struct ExitData {
        uint256 exitBondSize;
        address exitInitiator;
        uint256 exitAmount;
        address token;
    }

    mapping(uint168 => ExitData) private exitData;

    /**
     * @notice provide PlasmaFramework contract-address when deploying the contract
    */
    constructor(address plasmaFrameworkContract) public ERC721Full("OMG Exit", "OMGE") {
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

        mintNFT(rlpOutputTxToContract, utxoPosToExit, decodedSecondTx);
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
        require(root != bytes32(0x0), "Failed to get root of the block");
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
     * @notice mint an ERC-721 wrapping the exit
     * @param rlpOutputTxToContract RLP-encoded transaction that creates the outputs for the contract
     * @param utxoPosToExit position of the output which the contract has to exit
     * @param decodedSecondTx decoded second transaction
    */
    function mintNFT(bytes memory rlpOutputTxToContract, uint256 utxoPosToExit, PaymentTransactionModel.Transaction memory decodedSecondTx) private {
        uint168 exitId = paymentExitGame.getStandardExitId(false, rlpOutputTxToContract, utxoPosToExit);
        super._mint(msg.sender, exitId);

        FungibleTokenOutputModel.Output memory outputFromSecondTransaction
        = decodedSecondTx.outputs[0];
        exitData[exitId] = ExitData(
            msg.value - ExitBounty.processStandardExitBountySize(),
            msg.sender,
            outputFromSecondTransaction.amount,
            outputFromSecondTransaction.token
        );
    }

    /**
     * @dev Get Amount from contract after exit is processed - (to be updated)
     * @param exitId The exit id
    */
    function withdrawExit(uint168 exitId) public {
        require(
            super.ownerOf(exitId) == msg.sender,
            "Only the NFT owner of the respective exit can withdraw"
        );
        require(isExitProcessed(exitId), "Exit not Processed");
        super._burn(msg.sender, exitId);

        if (exitData[exitId].token == address(0)) {
            msg.sender.transfer(exitData[exitId].exitAmount);
        } else {
            IERC20(exitData[exitId].token).safeTransfer(msg.sender, exitData[exitId].exitAmount);
        }
    }

    /**
     * @dev Get Exit bond back - to be called by exit intitiator
     * @param exitId The exit id
    */
    function withdrawExitBond(uint168 exitId) public {
        require(exitData[exitId].exitInitiator != address(0), "Exit Bond does not exist or has already been claimed");
        require(msg.sender == exitData[exitId].exitInitiator, "Only the Exit Initiator can claim the bond");

        require(isExitProcessed(exitId), "Exit not Processed");
        exitData[exitId].exitInitiator = address(0);
        msg.sender.transfer(exitData[exitId].exitBondSize);
    }

    /**
     * @dev Check if the exit is Processed
     * @param exitId The exit id
    */
    function isExitProcessed(uint168 exitId) private returns (bool) {
        uint168[] memory exitIdList = new uint168[](1);
        exitIdList[0] = exitId;
        PaymentExitDataModel.StandardExit[] memory exits = paymentExitGame.standardExits(
            exitIdList
        );
        return exits[0].utxoPos == 0;
    }

    /**
     * @dev for the contract to receive funds after the exit has been processed
    */
    function() external payable {

    }
}
