pragma solidity 0.5.11;

import "./models/BlockModel.sol";
import "./registries/VaultRegistry.sol";
import "../utils/OnlyFromAddress.sol";

/**
* @notice Controls the logic and functions for block submissions in PlasmaFramework
* @dev We have two kinds of blocks: child block and deposit block.
*      Each child block has an interval of 'childBlockInterval'.
*      The interval is preserved for deposits. Each deposit results in one deposit block.
*      For instance, a child block would be in block 1000 and the next deposit would result in block 1001.
*
*      Meanwhile, block submission can only be done by the authority address.
*      There is some limitation on the authority address, see: https://github.com/omisego/elixir-omg#managing-the-operator-address
*/
contract BlockController is OnlyFromAddress, VaultRegistry {
    address public authority;
    uint256 public childBlockInterval;
    uint256 public nextChildBlock;
    uint256 public nextDeposit;

    mapping (uint256 => BlockModel.Block) public blocks; // block number => Block data

    event BlockSubmitted(
        uint256 blockNumber
    );

    constructor(uint256 _interval, uint256 _minExitPeriod, uint256 _initialImmuneVaults, address _authority, address _maintainer)
        public
        VaultRegistry(_minExitPeriod, _initialImmuneVaults, _maintainer)
    {
        authority = _authority;
        childBlockInterval = _interval;
        nextChildBlock = childBlockInterval;
        nextDeposit = 1;
    }

    /**
     * @notice Allows the operator to set a new authority address. This allows to implement mechanical
     * re-org protection mechanism, explained in https://github.com/omisego/plasma-contracts/issues/118
     * @param newAuthority address of new authority, cannot be blank.
     */
    function setAuthority(address newAuthority) external onlyFrom(authority) {
        require(newAuthority != address(0), "Authority cannot be zero-address.");
        authority = newAuthority;
    }

    /**
     * @notice Allows the authority to submit the Merkle root of a plasma block.
     * @dev emit BlockSubmitted event
     * @dev Block number jumps 'childBlockInterval' per submission.
     * @dev see discussion in https://github.com/omisego/plasma-contracts/issues/233
     * @param _blockRoot Merkle root of the plasma block.
     */
    function submitBlock(bytes32 _blockRoot) external onlyFrom(authority) {
        uint256 submittedBlockNumber = nextChildBlock;

        blocks[submittedBlockNumber] = BlockModel.Block({
            root: _blockRoot,
            timestamp: block.timestamp
        });

        nextChildBlock += childBlockInterval;
        nextDeposit = 1;

        emit BlockSubmitted(submittedBlockNumber);
    }

    /**
     * @notice Submits a block for deposit.
     * @dev Block number adds 1 per submission, could have at most 'childBlockInterval' deposit blocks between two child chain blocks.
     * @param _blockRoot Merkle root of the plasma block.
     * @return the deposit block number
     */
    function submitDepositBlock(bytes32 _blockRoot) public onlyFromNonQuarantinedVault returns (uint256) {
        require(nextDeposit < childBlockInterval, "Exceeded limit of deposits per child block interval");

        uint256 blknum = nextDepositBlock();
        blocks[blknum] = BlockModel.Block({
            root : _blockRoot,
            timestamp : block.timestamp
        });

        nextDeposit++;
        return blknum;
    }

    function nextDepositBlock() public view returns (uint256) {
        return nextChildBlock - childBlockInterval + nextDeposit;
    }
}
