pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/SafeEthTransfer.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract QuasarPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public quasarMaintainer;
    uint256 constant internal SAFE_GAS_STIPEND = 2300;

    modifier onlyQuasarMaintainer() {
        require(msg.sender == quasarMaintainer, "Only the Quasar Maintainer can invoke this method");
        _;
    }
    
    mapping (address => uint256) public tokenUsableCapacity;
    event QuasarTotalCapacityUpdated(address token, uint256 balance);

    /**
     * @dev Add Eth Liquid funds to the quasar
    */
    function addEthCapacity() public payable {
        address token = address(0);
        tokenUsableCapacity[token] = tokenUsableCapacity[token].add(msg.value);
        emit QuasarTotalCapacityUpdated(token, tokenUsableCapacity[token]);
    }

    /**
     * @dev Add ERC20 Liquid funds to the quasar
    */
    function addTokenCapacity(address token, uint256 amount) public {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenUsableCapacity[token] = tokenUsableCapacity[token].add(amount);
        emit QuasarTotalCapacityUpdated(token, tokenUsableCapacity[token]);
    }

    /**
     * @dev Withdraw Eth funds from the contract
     * @param amount amount of Eth(in wei) to withdraw
    */
    function withdrawEth(uint256 amount) public onlyQuasarMaintainer() {
        address token = address(0);
        require(amount <= tokenUsableCapacity[token], "Amount should be lower than claimable funds");
        tokenUsableCapacity[token] = tokenUsableCapacity[token].sub(amount);
        SafeEthTransfer.transferRevertOnError(msg.sender, amount, SAFE_GAS_STIPEND);
        emit QuasarTotalCapacityUpdated(token, tokenUsableCapacity[token]);
    }

    /**
     * @dev Withdraw Erc20 funds from the contract
     * @param token the erc20 token
     * @param amount amount of the token to withdraw
    */
    function withdrawErc20(address token, uint256 amount) public onlyQuasarMaintainer() {
        require(amount <= tokenUsableCapacity[token], "Amount should be lower than claimable funds");
        tokenUsableCapacity[token] = tokenUsableCapacity[token].sub(amount);
        IERC20(token).safeTransfer(msg.sender, amount);
        emit QuasarTotalCapacityUpdated(token, tokenUsableCapacity[token]);
    }
}
