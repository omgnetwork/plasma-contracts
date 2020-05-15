pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../exits/payment/PaymentExitGame.sol";
import "../framework/PlasmaFramework.sol";
import "../transactions/PaymentTransactionModel.sol";
import "../utils/PosLib.sol";
import "../framework/models/BlockModel.sol";
import "../utils/Merkle.sol";
import "../exits/payment/routers/PaymentStandardExitRouter.sol";

/** @title Liquidity Contract. */
contract liquidity {
    PaymentExitGame peg;
    address targetPaymentExitGameContract;

    PlasmaFramework pf;
    address targetPlasmaFrameworkContract;

    mapping(address => uint160[]) userExitIds;
    mapping(uint160 => address) exitIdtoUser;
    mapping(uint160 => uint256) exitIdtoAmount;

    /**
     * @notice generates instances of omg-contracts
    */
    constructor(address _plasmaFrameworkContract) public {
        targetPlasmaFrameworkContract = _plasmaFrameworkContract;
        pf = PlasmaFramework(targetPlasmaFrameworkContract);
        targetPaymentExitGameContract = pf.exitGames(1);
        peg = PaymentExitGame(targetPaymentExitGameContract);
    }

    function getCurrentBondSize() public view returns (uint128) {
        return peg.startStandardExitBondSize();
    }

    /**
     * @dev gets the index of the output from the utxo position
     * @param _utxoPos position of the output
    */
    function getOutputIndex(uint256 _utxoPos) internal pure returns (uint16) {
        uint256 TX_OFFSET = 10000;
        return uint16(_utxoPos % TX_OFFSET);
    }

    /**
     * @dev Call this func to start the exit on Rootchain contract
     * @param _utxoPosToExit position of the output which the contract has to exit
     * @param _rlpOutputTxToContract RLP-encoded transaction that creates the output for the contract
     * @param _outputTxToContractInclusionProof Second Transaction's inclusion proof
     * @param _rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param _inputCreationTxInclusionProof First transactions inclusion proofs
     * @param _utxoPosInput position of the output that created the inputs for second transaction
    */
    function startExitOnRootchainContract(
        uint256 _utxoPosToExit,
        bytes memory _rlpOutputTxToContract,
        bytes memory _outputTxToContractInclusionProof,
        bytes memory _rlpInputCreationTx,
        bytes memory _inputCreationTxInclusionProof,
        uint256 _utxoPosInput
    ) public payable {

        verifyOwnership(_rlpInputCreationTx, _utxoPosInput);


            PaymentTransactionModel.Transaction memory decodedSecondTx
         = PaymentTransactionModel.decode(_rlpOutputTxToContract);
        require(
            decodedSecondTx.inputs[0] == bytes32(_utxoPosInput),
            "Wrong utxoPosInput provided"
        );

        verifyTxValidity(
            _utxoPosInput,
            _rlpInputCreationTx,
            _inputCreationTxInclusionProof
        );
        runExit(
            _utxoPosToExit,
            _rlpOutputTxToContract,
            _outputTxToContractInclusionProof
        );

        // store the resultant exitid as a trait for the nft and map it to the msg.sender
        uint160 _exitId = getExitId(_rlpOutputTxToContract, 0);
        userExitIds[msg.sender].push(_exitId);
        exitIdtoUser[_exitId] = msg.sender;

        // associate the amount exiting to the exitId

            FungibleTokenOutputModel.Output memory outputFromSecondTransaction
         = decodedSecondTx.outputs[0];
        uint256 amount = outputFromSecondTransaction.amount;
        exitIdtoAmount[_exitId] = amount;
    }

    /**
     * @notice Check if the person calling is the same person who created the tx to the contract
     * @param _rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param _utxoPosInput position of the output that created the inputs for second transaction
    */
    function verifyOwnership(
        bytes memory _rlpInputCreationTx,
        uint256 _utxoPosInput
    ) internal {

            PaymentTransactionModel.Transaction memory decodedFirstTx
         = PaymentTransactionModel.decode(_rlpInputCreationTx);
        uint16 firstTransactionOutputIndex = getOutputIndex(_utxoPosInput);

            FungibleTokenOutputModel.Output memory outputFromFirstTransaction
         = decodedFirstTx.outputs[firstTransactionOutputIndex];
        address ownerFirstTxOutput = address(
            uint160(outputFromFirstTransaction.outputGuard)
        );
        require(
            ownerFirstTxOutput == msg.sender,
            "First Tx Provided was not called by sender"
        );
    }

    /**
     * @notice Verify the First Tx provided is valid
     * @param _utxoPosInput position of the output that created the inputs for second transaction
     * @param _rlpInputCreationTx RLP-encoded first transaction that transfers to this contract
     * @param _inputCreationTxInclusionProof First transactions inclusion proofs
    */
    function verifyTxValidity(
        uint256 _utxoPosInput,
        bytes memory _rlpInputCreationTx,
        bytes memory _inputCreationTxInclusionProof
    ) internal {
        PosLib.Position memory utxoDecoded = PosLib.decode(_utxoPosInput);
        utxoDecoded.outputIndex = 0;
        (bytes32 _root, ) = pf.blocks(utxoDecoded.blockNum);
        require(_root != bytes32(""), "Failed to get root of the block");
        bool txExists = Merkle.checkMembership(
            _rlpInputCreationTx,
            utxoDecoded.txIndex,
            _root,
            _inputCreationTxInclusionProof
        );
        require(
            txExists,
            "Provided Transaction isn't finalized or doesn't exist"
        );
    }

    /**
     * @notice func that calls omg-contracts to start the exit
     * @param _utxoPosToExit position of the output which the contract has to exit
     * @param _rlpOutputTxToContract RLP-encoded transaction that creates the output for the contract
     * @param _outputTxToContractInclusionProof Second Transaction's inclusion proof
    */
    function runExit(
        uint256 _utxoPosToExit,
        bytes memory _rlpOutputTxToContract,
        bytes memory _outputTxToContractInclusionProof
    ) internal {
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory s;
        s.utxoPos = _utxoPosToExit;
        s.rlpOutputTx = _rlpOutputTxToContract;
        s.outputTxInclusionProof = _outputTxToContractInclusionProof;
        peg.startStandardExit.value(msg.value)(s);
    }

    function getExitId(bytes memory _txBytes, uint16 _outputIndex)
        internal
        pure
        returns (uint160)
    {
        uint256 exitId = (uint256(keccak256(_txBytes)) >> 105) |
            (uint256(_outputIndex) << 152);
        uint160 croppedExitId = uint160(exitId);
        require(uint256(croppedExitId) == exitId, "ExitId overflows");
        return croppedExitId;
    }

    /**
     * @dev Get Amount from contract after exit is processed - (to be updated)
     * @param _exitId The exit id
    */
    function getWithdrawl(uint160 _exitId) public {
        require(
            exitIdtoUser[_exitId] == msg.sender,
            "Only the exitId owner can get the withdrawl"
        );
        uint160[] memory _exitIdList = new uint160[](1);
        _exitIdList[0] = _exitId;
        PaymentExitDataModel.StandardExit[] memory exits = peg.standardExits(
            _exitIdList
        );
        if (exits[0].utxoPos == 0) {
            msg.sender.transfer(exitIdtoAmount[_exitId]);
            exitIdtoUser[_exitId] = 0x0000000000000000000000000000000000000000;
        } else {
            revert("Not processed exit");
        }
    }
}
