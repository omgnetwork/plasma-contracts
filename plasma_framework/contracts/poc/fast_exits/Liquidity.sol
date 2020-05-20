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
    PaymentExitGame private paymentExitGame;

    PlasmaFramework private plasmaFrameworkInstance;

    mapping(address => uint160[]) public userExitIds;
    mapping(uint160 => address) public exitIdtoUser;
    mapping(uint160 => uint256) public exitIdtoAmount;

    /**
     * @notice provide PlasmaFramework contract-address when deploying the contract
    */
    constructor(address plasmaFrameworkContract) public {
        plasmaFrameworkInstance = PlasmaFramework(plasmaFrameworkContract);
        paymentExitGame = PaymentExitGame(plasmaFrameworkInstance.exitGames(1));
    }

    function getCurrentBondSize() public view returns (uint128) {
        return paymentExitGame.startStandardExitBondSize();
    }

    /**
     * @dev gets the index of the output from the utxo position
     * @param utxoPos position of the output
    */
    function getOutputIndex(uint256 utxoPos) private pure returns (uint16) {
        uint256 txOffset = 10000;
        return uint16(utxoPos % txOffset);
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

        verifyOwnership(rlpInputCreationTx, utxoPosInput);

        PaymentTransactionModel.Transaction memory decodedSecondTx
        = PaymentTransactionModel.decode(rlpOutputTxToContract);
        require(
            decodedSecondTx.inputs[0] == bytes32(utxoPosInput),
            "Wrong utxoPosInput provided"
        );

        verifyTxValidity(
            utxoPosInput,
            rlpInputCreationTx,
            inputCreationTxInclusionProof
        );
        runExit(
            utxoPosToExit,
            rlpOutputTxToContract,
            outputTxToContractInclusionProof
        );

        // store the resultant exitid as a trait for the nft and map it to the msg.sender
        uint160 exitId = getExitId(rlpOutputTxToContract, 0);
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
     * @param utxoPosInput position of the output that created the inputs for second transaction
    */
    function verifyOwnership(
        bytes memory rlpInputCreationTx,
        uint256 utxoPosInput
    ) internal {

        PaymentTransactionModel.Transaction memory decodedFirstTx
        = PaymentTransactionModel.decode(rlpInputCreationTx);
        uint16 firstTransactionOutputIndex = getOutputIndex(utxoPosInput);

        FungibleTokenOutputModel.Output memory outputFromFirstTransaction
        = decodedFirstTx.outputs[firstTransactionOutputIndex];
        address ownerFirstTxOutput = address(
            uint160(outputFromFirstTransaction.outputGuard)
        );
        require(
            ownerFirstTxOutput == msg.sender,
            "Was not called by the first Tx owner"
        );
    }

    /**
     * @notice Verify the First Tx provided is valid
     * @param utxoPosInput position of the output that created the inputs for second transaction
     * @param rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param inputCreationTxInclusionProof First transactions inclusion proofs
    */
    function verifyTxValidity(
        uint256 utxoPosInput,
        bytes memory rlpInputCreationTx,
        bytes memory inputCreationTxInclusionProof
    ) internal {
        PosLib.Position memory utxoDecoded = PosLib.decode(utxoPosInput);
        utxoDecoded.outputIndex = 0;
        (bytes32 root, ) = plasmaFrameworkInstance.blocks(utxoDecoded.blockNum);
        require(root != bytes32(""), "Failed to get root of the block");
        bool txExists = Merkle.checkMembership(
            rlpInputCreationTx,
            utxoDecoded.txIndex,
            root,
            inputCreationTxInclusionProof
        );
        require(
            txExists,
            "Provided Transaction isn't finalized or doesn't exist"
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
    ) internal {
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s;
        s.utxoPos = utxoPosToExit;
        s.rlpOutputTx = rlpOutputTxToContract;
        s.outputTxInclusionProof = outputTxToContractInclusionProof;
        paymentExitGame.startStandardExit.value(msg.value)(s);
    }

    function getExitId(bytes memory txBytes, uint16 outputIndex)
        internal
        pure
        returns (uint160)
    {
        uint256 exitId = (uint256(keccak256(txBytes)) >> 105) |
            (uint256(outputIndex) << 152);
        uint160 croppedExitId = uint160(exitId);
        require(uint256(croppedExitId) == exitId, "ExitId overflows");
        return croppedExitId;
    }

    function getContractBalance() public view returns(uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get Amount from contract after exit is processed - (to be updated)
     * @param exitId The exit id
    */
    function getWithdrawl(uint160 exitId) public {
        require(
            exitIdtoUser[exitId] == msg.sender,
            "Only the exitId owner can get the withdrawl"
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

    function() external payable {

    }
}
