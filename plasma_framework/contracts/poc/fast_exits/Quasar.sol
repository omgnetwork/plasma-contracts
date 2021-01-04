pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/framework/PlasmaFramework.sol";
import "../../src/utils/PosLib.sol";
import "../../src/utils/Merkle.sol";
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
contract Quasar {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using PosLib for PosLib.Position;

    PlasmaFramework public plasmaFramework;
    SpendingConditionRegistry public spendingConditionRegistry;

    address public quasarOwner;
    address public quasarMaintainer;
    uint256 public safePlasmaBlockNum;
    uint256 public waitingPeriod;
    uint256 public bondValue;
    // bond is added to the reserve only when tickets are flushed, bond is returned every other time
    uint256 private bondReserve;

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

    mapping (address => uint256) public tokenUsableCapacity;
    mapping (uint256 => Ticket) public ticketData;
    mapping (uint256 => Claim) private claimData;

    event QuasarTotalEthCapacityUpdated(uint256 balance);
    
    modifier onlyQuasarMaintainer() {
        require(msg.sender == quasarMaintainer, "Only the Quasar Maintainer can invoke this method");
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
        spendingConditionRegistry = SpendingConditionRegistry(spendingConditionRegistryContract);
        quasarOwner = _quasarOwner;
        quasarMaintainer = msg.sender;
        safePlasmaBlockNum = _safePlasmaBlockNum;
        waitingPeriod = _waitingPeriod;
        bondValue = _bondValue;
        bondReserve = 0;
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
     * @notice Only an unclaimed ticket can be flushed, bond amount is added to bondReserve
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
        bondReserve = bondReserve.add(ticketData[utxoPos].bondValue); 
    }

    /**
     * @dev Add Eth Liquid funds to the quasar
    */
    function addEthCapacity() public payable onlyQuasarMaintainer() {
        tokenUsableCapacity[address(0x0)] = tokenUsableCapacity[address(0x0)].add(msg.value);
        emit QuasarTotalEthCapacityUpdated(tokenUsableCapacity[address(0x0)]);
    }

    /**
     * @dev Withdraw Unblocked Eth funds from the contract
     * @param amount amount of Eth(in wei) to withdraw
    */
    function withdrawLiquidEthFunds(uint256 amount) public onlyQuasarMaintainer() {
        address token = address(0x0);
        uint256 withdrawableFunds = bondReserve.add(tokenUsableCapacity[token]);
        require(amount <= withdrawableFunds, "Amount should be lower than claimable funds");

        if (amount <= bondReserve) {
            bondReserve = bondReserve.sub(amount);
        } else {
            uint256 residualAlmount = amount.sub(bondReserve);
            bondReserve = 0;
            tokenUsableCapacity[token] = tokenUsableCapacity[token].sub(residualAlmount);
            emit QuasarTotalEthCapacityUpdated(tokenUsableCapacity[address(0x0)]);
        }
        SafeEthTransfer.transferRevertOnError(msg.sender, amount, 2300);
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
    function obtainTicket(uint256 utxoPos, bytes memory rlpOutputCreationTx, bytes memory outputCreationTxInclusionProof) public payable {
        PosLib.Position memory utxoPosDecoded = PosLib.decode(utxoPos);

        require(utxoPosDecoded.blockNum <= safePlasmaBlockNum, "UTXO is from a block over the safe limit");
        require(!ticketData[utxoPos].isClaimed, "The UTXO has already been claimed");
        require(ticketData[utxoPos].validityTimestamp == 0, "The ticket is still valid or needs to be flushed");

        PaymentTransactionModel.Transaction memory decodedTx
        = PaymentTransactionModel.decode(rlpOutputCreationTx);

        FungibleTokenOutputModel.Output memory outputData
        = PaymentTransactionModel.getOutput(decodedTx, utxoPosDecoded.outputIndex);
        
        // verify the owner of output is obtaining the ticket
        verifyOwnership(outputData, msg.sender);

        require(MoreVpFinalization.isStandardFinalized(
            plasmaFramework,
            rlpOutputCreationTx,
            utxoPosDecoded.toStrictTxPos(),
            outputCreationTxInclusionProof
        ), "Provided Tx doesn't exist");

        require(outputData.amount <= tokenUsableCapacity[outputData.token], "Requested amount exceeds the Usable Liqudity");
        require(outputData.amount != 0, "The reserved amount cannot be zero");
        require(msg.value == bondValue, "Bond Value incorrect");

        tokenUsableCapacity[outputData.token] = tokenUsableCapacity[outputData.token].sub(outputData.amount);
        ticketData[utxoPos] = Ticket(msg.sender, block.timestamp.add(14400), outputData.amount, outputData.token, msg.value, rlpOutputCreationTx, false);
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

    /**
     * @dev Challenge an active claim, can be used to challenge IFEClaims as well
     * @notice A challenge is required only when a tx that spends the same utxo was included previously
     * @param utxoPos pos of the output, which is the ticket identifier
     * @param rlpChallengeTx RLP-encoded challenge transaction
     * @param challengeTxInputIndex index pos of the same utxo in the challenge transaction
     * @param challengeTxWitness Witness for challenging transaction
    */
    function challengeClaim(
        uint256 utxoPos,
        bytes memory rlpChallengeTx,
        uint16 challengeTxInputIndex,
        bytes memory challengeTxWitness
    ) public {
        require(ticketData[utxoPos].isClaimed && claimData[utxoPos].isValid, "Not Challengeable");
        require(block.timestamp <= claimData[utxoPos].finalizationTimestamp, "Challenge Period Over");
        require(
            keccak256(claimData[utxoPos].rlpClaimTx) != keccak256(rlpChallengeTx),
            "The challenging transaction is the same as the claim transaction"
        );

        require(MoreVpFinalization.isProtocolFinalized(
            plasmaFramework,
            rlpChallengeTx
        ), "Provided Challenge Tx is not protocol finalized");

        verifySpendingCondition(utxoPos, rlpChallengeTx, challengeTxInputIndex, challengeTxWitness);
        
        claimData[utxoPos].isValid = false;
        Ticket memory ticket = ticketData[utxoPos];
        address token = ticket.token;
        uint256 ticketBondValue = ticket.bondValue;
        uint256 fundsReserved = ticket.reservedAmount;
        tokenUsableCapacity[token] = tokenUsableCapacity[token].add(fundsReserved);
        SafeEthTransfer.transferRevertOnError(msg.sender, ticketBondValue, 2300);
    }

    /**
     * @dev Process the Claim to get liquid funds
     * @param utxoPos pos of the output, which is the ticket identifier
    */
    function processClaim(uint256 utxoPos) public {
        require(block.timestamp > claimData[utxoPos].finalizationTimestamp, "Claim not finalized");
        require(claimData[utxoPos].isValid, "Already claimed or the claim was challenged");
        address payable outputOwner = ticketData[utxoPos].outputOwner;
        uint256 totalAmount = ticketData[utxoPos].reservedAmount.add(ticketData[utxoPos].bondValue);
        claimData[utxoPos].isValid = false;
        SafeEthTransfer.transferRevertOnError(outputOwner, totalAmount, 2300);
    }

    ////////////////////////////////////////////	
    // Helper methods	
    ////////////////////////////////////////////
    /**
     * @dev Verify the owner of the output
     * @param output Output Data
     * @param expectedOutputOwner expected owner of the output
    */
    function verifyOwnership(FungibleTokenOutputModel.Output memory output, address expectedOutputOwner) private pure {
        address outputOwner = PaymentTransactionModel.getOutputOwner(output);
        require(outputOwner == expectedOutputOwner, "Was not called by the Output owner");
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
        require(!ticketData[utxoPos].isClaimed, "Already Claimed");
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
        require(decodedTx.inputs[0] == bytes32(utxoPos), "Wrong Tx provided");

        // first output should be the utxo for Quasar owner
        FungibleTokenOutputModel.Output memory outputData
        = PaymentTransactionModel.getOutput(decodedTx, 0);

        // verify output to Quasar Owner
        verifyOwnership(outputData, quasarOwner);
        // considering fee as a separate input
        require(ticketData[utxoPos].reservedAmount == outputData.amount, "Wrong Amount Sent to Quasar Owner");
        require(ticketData[utxoPos].token == outputData.token, "Wrong Token Sent to Quasar Owner");
    }
}
