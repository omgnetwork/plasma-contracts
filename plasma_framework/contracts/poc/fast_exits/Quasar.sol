pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./QuasarPool.sol";
import "../../src/framework/PlasmaFramework.sol";
import "../../src/exits/payment/PaymentExitGame.sol";
import "../../src/utils/PosLib.sol";
import "../../src/utils/Merkle.sol";
import "../../src/exits/utils/ExitId.sol";
import "../../src/exits/payment/routers/PaymentInFlightExitRouter.sol";
import "../../src/utils/SafeEthTransfer.sol";
import "../../src/transactions/PaymentTransactionModel.sol";
import "../../src/transactions/GenericTransaction.sol";
import "../../src/exits/utils/MoreVpFinalization.sol";
import "../../src/exits/interfaces/ISpendingCondition.sol";
import "../../src/exits/registries/SpendingConditionRegistry.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title Quasar Contract
 * Implementation Doc - https://github.com/omgnetwork/research-workshop/blob/master/Incognito_fast_withdrawals.md
*/
contract Quasar is QuasarPool {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using SafeMath for uint64;
    using PosLib for PosLib.Position;

    PlasmaFramework public plasmaFramework;
    // the contract works with the current exit game
    // any changes to the exit game would require modifications to this contract
    // verify the exitGame before interacting
    PaymentExitGame public paymentExitGame;
    SpendingConditionRegistry public spendingConditionRegistry;

    address public quasarOwner;
    uint256 public safePlasmaBlockNum;
    uint256 public waitingPeriod;
    uint256 constant public TICKET_VALIDITY_PERIOD = 14400;
    uint256 constant public IFE_CLAIM_MARGIN = 28800;
    // 7+1 days waiting period for IFE Claims
    uint256 constant public IFE_CLAIM_WAITING_PERIOD = 691200;
    uint256 public bondValue;
    // bond is added to this reserve only when tickets are flushed, bond is returned every other time
    uint256 public unclaimedBonds;
    bool public isPaused;

    struct Ticket {
        address payable outputOwner;
        uint256 validityTimestamp;
        uint256 reservedAmount;
        address token;
        uint256 bondValue;
        bytes rlpOutputCreationTx;
        bool isClaimed;
    }

    struct Claim {
        bytes rlpClaimTx;
        uint256 finalizationTimestamp;
        bool isValid;
    }

    mapping (uint256 => Ticket) public ticketData;
    mapping (uint256 => Claim) private claimData;

    event NewTicketObtained(uint256 utxoPos);
    event IFEClaimSubmitted(uint256 utxoPos, uint168 exitId);
    
    modifier onlyQuasarMaintainer() {
        require(msg.sender == quasarMaintainer, "Only the Quasar Maintainer can invoke this method");
        _;
    }

    modifier onlyWhenNotPaused() {
        require(!isPaused, "The Quasar contract is paused");
        _;
    }

    /**
     * @dev Constructor, takes params to set up quasar contract
     * @param plasmaFrameworkContract Plasma Framework contract address
     * @param _quasarOwner Receiver address on Plasma
     * @param _safePlasmaBlockNum Safe Blocknum limit 
     * @param _waitingPeriod Waiting period from submission to processing claim
     * @param _bondValue bond to obtain tickets
    */
    constructor (address plasmaFrameworkContract, address spendingConditionRegistryContract, address _quasarOwner, uint256 _safePlasmaBlockNum, uint256 _waitingPeriod, uint256 _bondValue) public {
        plasmaFramework = PlasmaFramework(plasmaFrameworkContract);
        paymentExitGame = PaymentExitGame(plasmaFramework.exitGames(1));
        spendingConditionRegistry = SpendingConditionRegistry(spendingConditionRegistryContract);
        quasarOwner = _quasarOwner;
        quasarMaintainer = msg.sender;
        safePlasmaBlockNum = _safePlasmaBlockNum;
        waitingPeriod = _waitingPeriod;
        bondValue = _bondValue;
        unclaimedBonds = 0;
    }

    ////////////////////////////////////////////	
    // Maintenance methods	
    ////////////////////////////////////////////
    /**
     * @dev Update the safe blocknum limit
     * @param newSafePlasmaBlockNum new blocknum limit, has to be higher than previous blocknum limit
    */
    function updateSafeBlockLimit (uint256 newSafePlasmaBlockNum) public onlyQuasarMaintainer() {
        require(newSafePlasmaBlockNum > safePlasmaBlockNum, "New limit should be higher than older limit");
        safePlasmaBlockNum = newSafePlasmaBlockNum;
    }

    /**
     * @dev Flush an expired ticket to free up reserved space
     * @notice Only an unclaimed ticket can be flushed, bond amount is added to unclaimedBonds
     * @param utxoPos pos of the output, which is the ticket identifier
    */
    function flushExpiredTicket(uint256 utxoPos) public {
        uint256 expiryTimestamp = ticketData[utxoPos].validityTimestamp;
        require(!ticketData[utxoPos].isClaimed, "The UTXO has already been claimed");
        require(block.timestamp > expiryTimestamp && expiryTimestamp != 0, "Ticket still valid or doesn't exist");

        uint256 tokenAmount = ticketData[utxoPos].reservedAmount;
        ticketData[utxoPos].reservedAmount = 0;
        ticketData[utxoPos].validityTimestamp = 0;
        tokenUsableCapacity[ticketData[utxoPos].token] = tokenUsableCapacity[ticketData[utxoPos].token].add(tokenAmount);
        unclaimedBonds = unclaimedBonds.add(ticketData[utxoPos].bondValue); 
    }

    function pauseQuasar() public onlyQuasarMaintainer() {
        isPaused = true;
    }

    function resumeQuasar() public onlyQuasarMaintainer() {
        isPaused = false;
    }

    /**
     * @dev Withdraw Unclaimed bonds from the contract
    */
    function withdrawUnclaimedBonds() public onlyQuasarMaintainer() {
        uint256 amount = unclaimedBonds;
        unclaimedBonds = 0;
        SafeEthTransfer.transferRevertOnError(msg.sender, amount, SAFE_GAS_STIPEND);
    }

    ////////////////////////////////////////////	
    // Exit procedure	
    ////////////////////////////////////////////
    /**
     * @dev Obtain a ticket from the Quasar
     * @notice Ticket is valid for four hours, pay bond here for obtaining ticket
     * @param utxoPos Output that will be spent to the quasar later, is the ticket identifier
     * @param rlpOutputCreationTx RLP-encoded transaction that created the output
     * @param outputCreationTxInclusionProof Transaction inclusion proof
    */
    function obtainTicket(uint256 utxoPos, bytes memory rlpOutputCreationTx, bytes memory outputCreationTxInclusionProof) public payable onlyWhenNotPaused() {
        require(msg.value == bondValue, "Bond Value incorrect");
        require(!ticketData[utxoPos].isClaimed, "The UTXO has already been claimed");
        require(ticketData[utxoPos].validityTimestamp == 0, "This UTXO already has a ticket");

        PosLib.Position memory utxoPosDecoded = PosLib.decode(utxoPos);

        require(utxoPosDecoded.blockNum <= safePlasmaBlockNum, "The UTXO is from a block later than the safe limit");

        PaymentTransactionModel.Transaction memory decodedTx
        = PaymentTransactionModel.decode(rlpOutputCreationTx);

        FungibleTokenOutputModel.Output memory outputData
        = PaymentTransactionModel.getOutput(decodedTx, utxoPosDecoded.outputIndex);
        
        // verify the owner of output is obtaining the ticket
        require(verifyOwnership(outputData, msg.sender), "Was not called by the Output owner");

        require(MoreVpFinalization.isStandardFinalized(
            plasmaFramework,
            rlpOutputCreationTx,
            utxoPosDecoded.toStrictTxPos(),
            outputCreationTxInclusionProof
        ), "Provided Tx doesn't exist");

        require(outputData.amount <= tokenUsableCapacity[outputData.token], "Requested amount exceeds the Usable Liqudity");
        require(outputData.amount != 0, "Requested amount cannot be zero");

        tokenUsableCapacity[outputData.token] = tokenUsableCapacity[outputData.token].sub(outputData.amount);
        ticketData[utxoPos] = Ticket(msg.sender, block.timestamp.add(TICKET_VALIDITY_PERIOD), outputData.amount, outputData.token, msg.value, rlpOutputCreationTx, false);
        emit NewTicketObtained(utxoPos);
    }

    // for simplicity fee has to be from a seperate input in the tx to quasar
    /**
     * @dev Submit claim after spending the output to the quasar owner
     * @param utxoPos pos of the output, which is the ticket identifier
     * @param utxoPosQuasarOwner pos of the quasar owner's output
     * @param rlpTxToQuasarOwner RLP-encoded transaction that spends the output to quasar owner
     * @param txToQuasarOwnerInclusionProof Transaction Inclusion proof
    */
    function claim(
        uint256 utxoPos,
        uint256 utxoPosQuasarOwner,
        bytes memory rlpTxToQuasarOwner,
        bytes memory txToQuasarOwnerInclusionProof
    ) public {
        verifyTicketValidityForClaim(utxoPos);

        verifyClaimTxCorrectlyFormed(utxoPos, rlpTxToQuasarOwner);

        PosLib.Position memory utxoQuasarOwnerDecoded = PosLib.decode(utxoPosQuasarOwner);
        require(MoreVpFinalization.isStandardFinalized(
            plasmaFramework,
            rlpTxToQuasarOwner,
            utxoQuasarOwnerDecoded.toStrictTxPos(),
            txToQuasarOwnerInclusionProof
        ), "Provided Tx doesn't exist");

        ticketData[utxoPos].isClaimed = true;
        claimData[utxoPos] = Claim(rlpTxToQuasarOwner, block.timestamp.add(waitingPeriod), true);
    }

    function ifeClaim(uint256 utxoPos, bytes memory inFlightClaimTx) public {
        verifyTicketValidityForClaim(utxoPos);

        verifyClaimTxCorrectlyFormed(utxoPos, inFlightClaimTx);

        //verify IFE started
        uint168 exitId = ExitId.getInFlightExitId(inFlightClaimTx);
        uint168[] memory exitIdArr = new uint168[](1);
        exitIdArr[0] = exitId;
        PaymentExitDataModel.InFlightExit[] memory ifeData = paymentExitGame.inFlightExits(exitIdArr);
        require(ifeData[0].exitStartTimestamp != 0, "IFE has not been started");

        // ifeClaims should start within IFE_CLAIM_MARGIN from starting IFE to enable sufficient time to piggyback
        // this might be overriden by the ticket expiry check usually, except if the ticket is obtained later
        require(block.timestamp <= ifeData[0].exitStartTimestamp.add(IFE_CLAIM_MARGIN), "IFE Claim period has passed");

        ticketData[utxoPos].isClaimed = true;
        claimData[utxoPos] = Claim(inFlightClaimTx, block.timestamp.add(IFE_CLAIM_WAITING_PERIOD), true);
        emit IFEClaimSubmitted(utxoPos, exitId);
    }

    /**
     * @dev Challenge an active claim, can be used to challenge IFEClaims as well
     * @notice A challenge is required only when a tx that spends the same utxo was included previously
     * @param utxoPos pos of the output, which is the ticket identifier
     * @param rlpChallengeTx RLP-encoded challenge transaction
     * @param challengeTxInputIndex index pos of the same utxo in the challenge transaction
     * @param challengeTxWitness Witness for challenging transaction
     * @param senderData A keccak256 hash of the sender's address
    */
    function challengeClaim(
        uint256 utxoPos,
        bytes memory rlpChallengeTx,
        uint16 challengeTxInputIndex,
        bytes memory challengeTxWitness,
        bytes32 senderData
    ) public {
        require(senderData == keccak256(abi.encodePacked(msg.sender)), "Incorrect SenderData");
        require(ticketData[utxoPos].isClaimed && claimData[utxoPos].isValid, "The claim is not challengeable");
        require(block.timestamp <= claimData[utxoPos].finalizationTimestamp, "The challenge period is over");
        require(
            keccak256(claimData[utxoPos].rlpClaimTx) != keccak256(rlpChallengeTx),
            "The challenging transaction is the same as the claim transaction"
        );

        require(MoreVpFinalization.isProtocolFinalized(
            plasmaFramework,
            rlpChallengeTx
        ), "The challenging transaction is invalid");

        verifySpendingCondition(utxoPos, rlpChallengeTx, challengeTxInputIndex, challengeTxWitness);
        
        claimData[utxoPos].isValid = false;
        Ticket memory ticket = ticketData[utxoPos];
        tokenUsableCapacity[ticket.token] = tokenUsableCapacity[ticket.token].add(ticket.reservedAmount);
        SafeEthTransfer.transferRevertOnError(msg.sender, ticket.bondValue, SAFE_GAS_STIPEND);
    }

    /**
     * @dev Process the Claim to get liquid funds
     * @param utxoPos pos of the output, which is the ticket identifier
    */
    function processClaim(uint256 utxoPos) public {
        require(block.timestamp > claimData[utxoPos].finalizationTimestamp, "The claim is not finalized yet");
        require(claimData[utxoPos].isValid, "The claim has already been claimed or challenged");
        address payable outputOwner = ticketData[utxoPos].outputOwner;
        claimData[utxoPos].isValid = false;
        address token = ticketData[utxoPos].token;
        if(token == address(0)) {
            uint256 totalAmount = ticketData[utxoPos].reservedAmount.add(ticketData[utxoPos].bondValue);
            SafeEthTransfer.transferRevertOnError(outputOwner, totalAmount, SAFE_GAS_STIPEND);
        }
        else {
            IERC20(token).safeTransfer(outputOwner, ticketData[utxoPos].reservedAmount);
            SafeEthTransfer.transferRevertOnError(outputOwner, ticketData[utxoPos].bondValue, SAFE_GAS_STIPEND);
        }
    }

    ////////////////////////////////////////////	
    // Helper methods	
    ////////////////////////////////////////////
    /**
     * @dev Verify the owner of the output
     * @param output Output Data
     * @param expectedOutputOwner expected owner of the output
    */
    function verifyOwnership(FungibleTokenOutputModel.Output memory output, address expectedOutputOwner) private pure returns(bool) {
        address outputOwner = PaymentTransactionModel.getOutputOwner(output);
        return outputOwner == expectedOutputOwner;
    }

    /**
     * @dev Verify the challengeTx spends the output
     * @param utxoPos pos of the output, which is the ticket identifier
     * @param rlpChallengeTx RLP-encoded challenge transaction
     * @param challengeTxInputIndex index pos of the same utxo in the challenge transaction
     * @param challengeTxWitness Witness for challenging transaction
    */
    function verifySpendingCondition(uint256 utxoPos, bytes memory rlpChallengeTx, uint16 challengeTxInputIndex, bytes memory challengeTxWitness) private {
        GenericTransaction.Transaction memory challengingTx = GenericTransaction.decode(rlpChallengeTx);

        GenericTransaction.Transaction memory inputTx = GenericTransaction.decode(ticketData[utxoPos].rlpOutputCreationTx);
        PosLib.Position memory utxoPosDecoded = PosLib.decode(utxoPos);
        GenericTransaction.Output memory output = GenericTransaction.getOutput(inputTx, utxoPosDecoded.outputIndex);

        ISpendingCondition condition = spendingConditionRegistry.spendingConditions(
            output.outputType, challengingTx.txType
        );
        require(address(condition) != address(0), "Spending condition contract not found");
        bool isSpent = condition.verify(
            ticketData[utxoPos].rlpOutputCreationTx,
            utxoPos,
            rlpChallengeTx,
            challengeTxInputIndex,
            challengeTxWitness
        );
        require(isSpent, "Spending condition failed");
    }

    /**
     * @dev Verify the validity of the ticket
     * @param utxoPos pos of the output, which is the ticket identifier
    */
    function verifyTicketValidityForClaim(uint256 utxoPos) private {
        require(!ticketData[utxoPos].isClaimed, "Already claimed");
        require(ticketData[utxoPos].outputOwner == msg.sender, "Not called by the ticket owner");
        uint256 expiryTimestamp = ticketData[utxoPos].validityTimestamp;
        require(expiryTimestamp != 0 && block.timestamp <= expiryTimestamp, "Ticket is not valid");
    }
    
    /**
     * @dev Verify the claim Tx is properly formed
     * @param utxoPos pos of the output, which is the ticket identifier
     * @param claimTx the Claim Tx to the quasar owner
    */
    function verifyClaimTxCorrectlyFormed(uint256 utxoPos, bytes memory claimTx) private {
        PaymentTransactionModel.Transaction memory decodedTx
        = PaymentTransactionModel.decode(claimTx);

        // first input should be the Utxo with which ticket was obtained
        require(decodedTx.inputs[0] == bytes32(utxoPos), "The claim transaction does not spend the correct output");

        // first output should be the utxo for Quasar owner
        FungibleTokenOutputModel.Output memory outputData
        = PaymentTransactionModel.getOutput(decodedTx, 0);

        // verify output to Quasar Owner
        require(verifyOwnership(outputData, quasarOwner), "The output is not owned by the quasar owner");
        // considering fee as a separate input
        require(ticketData[utxoPos].reservedAmount == outputData.amount, "Wrong amount sent to quasar owner");
        require(ticketData[utxoPos].token == outputData.token, "Wrong token sent to quasar owner");
    }
}
