pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../src/utils/SafeEthTransfer.sol";
import "./utils/Exponential.sol";
import "./interfaces/IQToken.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract QuasarPool is Exponential {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Token {
        address qTokenAddress;
        uint256 exchangeRate;
        uint256 owedAmount;
        uint256 poolSupply;
        uint256 quasarFee;
    }

    address public quasarMaintainer;
    uint256 constant internal SAFE_GAS_STIPEND = 2300;
    uint256 constant private INITIAL_EXCHANGE_RATE_SCALED = 2e15;

    modifier onlyQuasarMaintainer() {
        require(msg.sender == quasarMaintainer, "Only the Quasar Maintainer can invoke this method");
        _;
    }
    
    mapping (address => Token) public tokenData;
    mapping (address => uint256) public tokenUsableCapacity;
    event QuasarTotalCapacityUpdated(address token, uint256 balance);

    /**
     * Verify QToken contract before supplying
     * @dev Add Eth Liquid funds to the quasar
    */
    function addEthCapacity() public payable {
        mintQTokens(address(0), msg.value);
    }

    /**
     * Verify QToken contract before supplying
     * @dev Add ERC20 Liquid funds to the quasar
     * @param token the token
     * @param amount value to supply
    */
    function addTokenCapacity(address token, uint256 amount) public {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        mintQTokens(token, amount);
    }

    /**
     * @dev Internal function, determine and mint tokens for supplier
     * @param token the token
     * @param amount value to supply
    */
    function mintQTokens(address token, uint256 amount) private {
        require(tokenData[token].qTokenAddress != address(0), "QToken is not registered for the token");

        tokenUsableCapacity[token] = tokenUsableCapacity[token].add(amount);
        tokenData[token].poolSupply = tokenData[token].poolSupply.add(amount);

        // derive qTokens to mint
        uint256 qTokenMintAmount = Exponential.divScalarByExpTruncate(amount, Exp({mantissa: tokenData[token].exchangeRate}));
        IQToken(tokenData[token].qTokenAddress).mint(msg.sender, qTokenMintAmount);

        emit QuasarTotalCapacityUpdated(token, tokenUsableCapacity[token]);
    }

    /**
     * @dev Withdraw funds from the contract
     * @param token the token
     * @param amount amount (in number of qTokens) to withdraw
    */
    function withdrawFunds(address token, uint256 amount) public {
        address qToken = tokenData[token].qTokenAddress;
        uint256 qTokenBalance = IERC20(qToken).balanceOf(msg.sender);
        require(amount <= qTokenBalance, "Not enough qToken Balance");

        // derive amount from number of qTokens
        uint256 tokenWithdrawable = Exponential.mulScalarTruncate(Exp({mantissa: tokenData[token].exchangeRate}), amount);
        require(tokenWithdrawable <= tokenUsableCapacity[token], "Amount should be lower than claimable funds");

        tokenUsableCapacity[token] = tokenUsableCapacity[token].sub(tokenWithdrawable);
        tokenData[token].poolSupply = tokenData[token].poolSupply.sub(tokenWithdrawable);

        // burn qTokens from supply
        IQToken(qToken).burn(msg.sender, amount);

        if (token == address(0)) {
            SafeEthTransfer.transferRevertOnError(msg.sender, tokenWithdrawable, SAFE_GAS_STIPEND);
        } else {
            IERC20(token).safeTransfer(msg.sender, tokenWithdrawable);
        }

        emit QuasarTotalCapacityUpdated(token, tokenUsableCapacity[token]);
    }

    /**
     * Higher decimal for erc20 preffered
     * @dev Register a token to be allowed, deploy qToken first
     * @param token the token
     * @param qTokenContract the address of the qToken contract
     * @param quasarFee amount (in token's denomination) to be used as a fee
    */
    function registerQToken(address token, address qTokenContract, uint256 quasarFee) public onlyQuasarMaintainer() {
        require(tokenData[token].qTokenAddress == address(0), "QToken for the token already exists");
        tokenData[token] = Token(qTokenContract, INITIAL_EXCHANGE_RATE_SCALED, 0, 0, quasarFee);
    }

    /**
     * @dev Repay owed funds to the pool
     * @param token the token
     * @param amount amount to repay
    */
    function repayOwedToken(address token, uint256 amount) public payable {
        if (token == address(0)) {
            amount = msg.value;
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        tokenUsableCapacity[token] = tokenUsableCapacity[token].add(amount);
        tokenData[token].owedAmount = tokenData[token].owedAmount.sub(amount);   
    }
}
