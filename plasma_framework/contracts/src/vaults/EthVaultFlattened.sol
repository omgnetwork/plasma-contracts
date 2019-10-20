
// File: contracts/src/vaults/ZeroHashesProvider.sol

pragma solidity 0.5.11;

library ZeroHashesProvider {

    /**
     * @dev Pre-computes zero hashes to be used for building merkle tree for deposit block
     */
    function getZeroHashes() internal pure returns (bytes32[16] memory) {
        bytes32[16] memory zeroHashes;
        bytes32 zeroHash = keccak256(abi.encodePacked(uint256(0)));
        for (uint i = 0; i < 16; i++) {
            zeroHashes[i] = zeroHash;
            zeroHash = keccak256(abi.encodePacked(zeroHash, zeroHash));
        }
        return zeroHashes;
    }
}

// File: contracts/src/framework/models/BlockModel.sol

pragma solidity 0.5.11;

library BlockModel {
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }
}

// File: contracts/src/framework/utils/Operated.sol

pragma solidity 0.5.11;

contract Operated {
    address private _operator;

    constructor() public {
        _operator = msg.sender;
    }

    modifier onlyOperator() {
        require(msg.sender == _operator, "Not being called by operator");
        _;
    }

    function operator() public view returns(address) {
        return _operator;
    }
}

// File: contracts/src/framework/utils/Quarantine.sol

pragma solidity 0.5.11;

/**
 * @title Provides a way to quarantine (disable) contracts for a period of time
 * @dev The immunitiesRemaining member allows us to deploy the platform with some
 * pre-verified contracts that don't get quarantined.
 */
library Quarantine {
    struct Data {
        mapping(address => uint256) store;
        uint256 quarantinePeriod;
        uint256 immunitiesRemaining;
    }

    function isQuarantined(Data storage _self, address _contractAddress) internal view returns (bool) {
        return block.timestamp < _self.store[_contractAddress];
    }

    /**
     * @notice Put a contract into quarantine.
     * @param _contractAddress the address of the contract.
     */
    function quarantine(Data storage _self, address _contractAddress) internal {
        require(_contractAddress != address(0), "Can not quarantine an empty address");
        require(_self.store[_contractAddress] == 0, "The contract is already quarantined");

        if (_self.immunitiesRemaining == 0) {
            _self.store[_contractAddress] = block.timestamp + _self.quarantinePeriod;
        } else {
            _self.immunitiesRemaining--;
        }
    }
}

// File: contracts/src/framework/registries/VaultRegistry.sol

pragma solidity 0.5.11;



contract VaultRegistry is Operated {
    using Quarantine for Quarantine.Data;

    mapping(uint256 => address) private _vaults;
    mapping(address => uint256) private _vaultToId;
    Quarantine.Data private _quarantine;

    event VaultRegistered(
        uint256 vaultId,
        address vaultAddress
    );

    constructor (uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        public
    {
        _quarantine.quarantinePeriod = _minExitPeriod;
        _quarantine.immunitiesRemaining = _initialImmuneVaults;
    }

    modifier onlyFromNonQuarantinedVault() {
        require(_vaultToId[msg.sender] > 0, "Not being called by registered vaults");
        require(!_quarantine.isQuarantined(msg.sender), "Vault is quarantined.");
        _;
    }

    /**
     * @notice Register the vault to Plasma framework. This can be only called by contract admin.
     * @param _vaultId the id for the vault contract to register.
     * @param _vaultAddress address of the vault contract.
     */
    function registerVault(uint256 _vaultId, address _vaultAddress) public onlyOperator {
        require(_vaultId != 0, "should not register with vault id 0");
        require(_vaultAddress != address(0), "should not register an empty vault address");
        require(_vaults[_vaultId] == address(0), "The vault id is already registered");
        require(_vaultToId[_vaultAddress] == 0, "The vault contract is already registered");

        _vaults[_vaultId] = _vaultAddress;
        _vaultToId[_vaultAddress] = _vaultId;
        _quarantine.quarantine(_vaultAddress);

        emit VaultRegistered(_vaultId, _vaultAddress);
    }

    function vaults(uint256 _vaultId) public view returns (address) {
        return _vaults[_vaultId];
    }

    function vaultToId(address _vaultAddress) public view returns (uint256) {
        return _vaultToId[_vaultAddress];
    }
}

// File: contracts/src/framework/BlockController.sol

pragma solidity 0.5.11;




contract BlockController is Operated, VaultRegistry {
    address public authority;
    uint256 public childBlockInterval;
    uint256 public nextChildBlock;
    uint256 public nextDepositBlock;

    mapping (uint256 => BlockModel.Block) public blocks;

    event BlockSubmitted(
        uint256 blockNumber
    );

    constructor(uint256 _interval, uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        public
        VaultRegistry(_minExitPeriod, _initialImmuneVaults)
    {
        childBlockInterval = _interval;
        nextChildBlock = childBlockInterval;
        nextDepositBlock = 1;
    }

    /**
     * @notice Sets the operator's authority address and unlocks block submission.
     * @dev Can be called only once, before any call to `submitBlock`.
     * @dev All block submission then needs to be send from msg.sender address.
     * @dev see discussion in https://github.com/omisego/plasma-contracts/issues/233
     */
    function initAuthority() external {
        require(authority == address(0), "Authority address has been already set.");
        authority = msg.sender;
    }

    /**
     * @notice Allows the operator to set a new authority address. This allows to implement mechanical
     * re-org protection mechanism, explained in https://github.com/omisego/plasma-contracts/issues/118
     * @param newAuthority address of new authority, cannot be blank.
     */
    function setAuthority(address newAuthority) external onlyOperator {
        require(newAuthority != address(0), "Authority cannot be zero-address.");
        authority = newAuthority;
    }

    /**
     * @notice Allows operator's authority address to submit a child chain block.
     * @dev Block number jumps 'childBlockInterval' per submission.
     * @dev see discussion in https://github.com/omisego/plasma-contracts/issues/233
     * @param _blockRoot Merkle root of the block.
     */
    function submitBlock(bytes32 _blockRoot) external {
        require(msg.sender == authority, "Can be called only by the Authority.");
        uint256 submittedBlockNumber = nextChildBlock;

        blocks[submittedBlockNumber] = BlockModel.Block({
            root: _blockRoot,
            timestamp: block.timestamp
        });

        nextChildBlock += childBlockInterval;
        nextDepositBlock = 1;

        emit BlockSubmitted(submittedBlockNumber);
    }

    /**
     * @notice Submits block for deposit and returns deposit block number.
     * @dev Block number adds 1 per submission, could have at most 'childBlockInterval' deposit blocks between two child chain blocks.
     * @param _blockRoot Merkle root of the block.
     */
    function submitDepositBlock(bytes32 _blockRoot) public onlyFromNonQuarantinedVault returns (uint256) {
        require(nextDepositBlock < childBlockInterval, "Exceeded limit of deposits per child block interval");

        uint256 blknum = nextChildBlock - childBlockInterval + nextDepositBlock;
        blocks[blknum] = BlockModel.Block({
            root : _blockRoot,
            timestamp : block.timestamp
        });

        nextDepositBlock++;
        return blknum;
    }
}

// File: contracts/src/framework/interfaces/IExitProcessor.sol

pragma solidity 0.5.11;

interface IExitProcessor {
    /**
     * @dev Custom function to process exit. Would do nothing if not able to exit (eg. successfully challenged)
     * @param _exitId unique id for exit per tx type.
     */
    function processExit(uint192 _exitId) external;
}

// File: contracts/src/framework/Protocol.sol

pragma solidity 0.5.11;

library Protocol {
    uint8 constant internal MVP_VALUE = 1;
    uint8 constant internal MORE_VP_VALUE = 2;
    
    // solhint-disable-next-line func-name-mixedcase
    function MVP() internal pure returns (uint8) {
        return MVP_VALUE;
    }

    // solhint-disable-next-line func-name-mixedcase
    function MORE_VP() internal pure returns (uint8) {
        return MORE_VP_VALUE;
    }

    function isValidProtocol(uint8 protocol) internal pure returns (bool) {
        return protocol == MVP_VALUE || protocol == MORE_VP_VALUE;
    }
}

// File: contracts/src/framework/registries/ExitGameRegistry.sol

pragma solidity 0.5.11;




contract ExitGameRegistry is Operated {
    using Quarantine for Quarantine.Data;

    mapping(uint256 => address) public exitGames;
    mapping(address => uint256) public exitGameToTxType;
    mapping(uint256 => uint8) public protocols;
    Quarantine.Data public quarantine;

    event ExitGameRegistered(
        uint256 txType,
        address exitGameAddress,
        uint8 protocol
    );

    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
    {
        quarantine.quarantinePeriod = 3 * _minExitPeriod;
        quarantine.immunitiesRemaining = _initialImmuneExitGames;
    }

    modifier onlyFromNonQuarantinedExitGame() {
        require(exitGameToTxType[msg.sender] != 0, "Not being called by registered exit game contract");
        require(!quarantine.isQuarantined(msg.sender), "ExitGame is quarantined.");
        _;
    }

    /**
     * @dev Exposes information about exit games quarantine
     * @param _contract address of exit game contract
     * @return A boolean value denoting whether contract is safe to use, is not under quarantine
     */
    function isExitGameSafeToUse(address _contract) public view returns (bool) {
        return exitGameToTxType[_contract] != 0 && !quarantine.isQuarantined(_contract);
    }

    /**
     * @notice Register the exit game to Plasma framework. This can be only called by contract admin.
     * @param _txType tx type that the exit game want to register to.
     * @param _contract Address of the exit game contract.
     * @param _protocol The protocol of the transaction, 1 for MVP and 2 for MoreVP.
     */
    function registerExitGame(uint256 _txType, address _contract, uint8 _protocol) public onlyOperator {
        require(_txType != 0, "should not register with tx type 0");
        require(_contract != address(0), "should not register with an empty exit game address");
        require(Protocol.isValidProtocol(_protocol), "Invalid protocol value");

        require(exitGames[_txType] == address(0), "The tx type is already registered");
        require(exitGameToTxType[_contract] == 0, "The exit game contract is already registered");

        exitGames[_txType] = _contract;
        exitGameToTxType[_contract] = _txType;
        protocols[_txType] = _protocol;
        quarantine.quarantine(_contract);

        emit ExitGameRegistered(_txType, _contract, _protocol);
    }

}

// File: openzeppelin-solidity/contracts/ownership/Ownable.sol

pragma solidity ^0.5.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be aplied to your functions to restrict their use to
 * the owner.
 */
contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * > Note: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: openzeppelin-solidity/contracts/math/SafeMath.sol

pragma solidity ^0.5.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, "SafeMath: division by zero");
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, "SafeMath: modulo by zero");
        return a % b;
    }
}

// File: contracts/src/framework/utils/PriorityQueue.sol

pragma solidity 0.5.11;



/**
 * @title PriorityQueue
 * @dev Min-heap priority queue implementation.
 */
contract PriorityQueue is Ownable {
    using SafeMath for uint256;

    struct Queue {
        uint256[] heapList;
        uint256 currentSize;
    }

    Queue internal queue;

    constructor() public {
        queue.heapList = [0];
        queue.currentSize = 0;
    }

    function currentSize() external view returns (uint256) {
        return queue.currentSize;
    }

    function heapList() external view returns (uint256[] memory) {
        return queue.heapList;
    }

    /**
     * @notice Inserts an element into the queue by the owner.
     * @dev Does not perform deduplication.
     */
    function insert(uint256 _element) external onlyOwner {
        queue.heapList.push(_element);
        queue.currentSize = queue.currentSize.add(1);
        percUp(queue, queue.currentSize);
    }

    /**
     * @notice Deletes the smallest element from the queue.
     * @return The smallest element in the priority queue.
     */
    function delMin() external onlyOwner returns (uint256) {
        uint256 retVal = queue.heapList[1];
        queue.heapList[1] = queue.heapList[queue.currentSize];
        delete queue.heapList[queue.currentSize];
        queue.currentSize = queue.currentSize.sub(1);
        percDown(queue, 1);
        queue.heapList.length = queue.heapList.length.sub(1);
        return retVal;
    }

    /**
     * @notice Returns the smallest element from the queue.
     * @dev Fails when queue is empty.
     * @return The smallest element in the priority queue.
     */
    function getMin() external view returns (uint256) {
        return queue.heapList[1];
    }

    /*
     *  Private functions
     */
    function percUp(Queue storage self, uint256 pointer) private {
        uint256 i = pointer;
        uint256 j = i;
        uint256 newVal = self.heapList[i];
        while (newVal < self.heapList[i.div(2)]) {
            self.heapList[i] = self.heapList[i.div(2)];
            i = i.div(2);
        }
        if (i != j) {
            self.heapList[i] = newVal;
        }
    }

    function percDown(Queue storage self, uint256 pointer) private {
        uint256 i = pointer;
        uint256 j = i;
        uint256 newVal = self.heapList[i];
        uint256 mc = minChild(self, i);
        while (mc <= self.currentSize && newVal > self.heapList[mc]) {
            self.heapList[i] = self.heapList[mc];
            i = mc;
            mc = minChild(self, i);
        }
        if (i != j) {
            self.heapList[i] = newVal;
        }
    }

    function minChild(Queue storage self, uint256 i) private view returns (uint256) {
        if (i.mul(2).add(1) > self.currentSize) {
            return i.mul(2);
        } else {
            if (self.heapList[i.mul(2)] < self.heapList[i.mul(2).add(1)]) {
                return i.mul(2);
            } else {
                return i.mul(2).add(1);
            }
        }
    }
}

// File: contracts/src/utils/TxPosLib.sol

pragma solidity 0.5.11;

/**
@dev transaction position = (blockNumber * BLOCK_OFFSET_FOR_TX_POS + txIndex).
 */
library TxPosLib {
    struct TxPos {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET_FOR_TX_POS = 1000000000 / 10000;

    /**
     * @notice Given a TX position, returns the block number.
     * @param _txPos position of transaction.
     * @return The output's block number.
     */
    function blockNum(TxPos memory _txPos)
        internal
        pure
        returns (uint256)
    {
        return _txPos.value / BLOCK_OFFSET_FOR_TX_POS;
    }

    /**
     * @notice Given a Tx position, returns the transaction index.
     * @param _txPos position of transaction.
     * @return The output's transaction index.
     */
    function txIndex(TxPos memory _txPos)
        internal
        pure
        returns (uint256)
    {
        return _txPos.value % BLOCK_OFFSET_FOR_TX_POS;
    }
}

// File: contracts/src/framework/utils/ExitPriority.sol

pragma solidity 0.5.11;


library ExitPriority {
    /**
     * @dev formula of priority is as followed: (exitableAt || txPos || nonce).
     * The first 64 bit for exitableAt, following 128 bits of txPos and then 64 bits of nonce.
     * The combination of 'exitableAt' and 'txPos' is the priority for Plasma M(ore)VP protocol.
     * 'exitableAt' only provide granularity of block, thus add 'txPos' to provide priority of transaction.
     */
    function computePriority(uint64 exitableAt, TxPosLib.TxPos memory txPos, uint64 nonce)
        internal
        pure
        returns (uint256)
    {
        return ((uint256(exitableAt) << 192) | (uint128(txPos.value) << 64) | nonce);
    }

    function parseExitableAt(uint256 priority) internal pure returns (uint64) {
        return uint64(priority >> 192);
    }
}

// File: contracts/src/framework/ExitGameController.sol

pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;






contract ExitGameController is ExitGameRegistry {
    uint64 public exitQueueNonce = 1;
    mapping (uint256 => Exit) public exits;
    mapping (address => PriorityQueue) public exitsQueues;
    mapping (bytes32 => bool) public isOutputSpent;

    struct Exit {
        IExitProcessor exitProcessor;
        uint192 exitId; // The id for exit processor to identify specific exit within an exit game.
    }

    event TokenAdded(
        address token
    );

    event ProcessedExitsNum(
        uint256 processedNum,
        address token
    );

    event ExitQueued(
        uint192 indexed exitId,
        uint256 uniquePriority
    );

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameRegistry(_minExitPeriod, _initialImmuneExitGames)
    {
        address ethToken = address(0);
        exitsQueues[ethToken] = new PriorityQueue();
    }

    /**
     * @notice Add token to the plasma framework and initiate the priority queue.
     * @notice ETH token is supported by default on deployment.
     * @dev the queue is created as a new contract instance.
     * @param _token Address of the token.
     */
    function addToken(address _token) external {
        require(!hasToken(_token), "Such token has already been added");

        exitsQueues[_token] = new PriorityQueue();
        emit TokenAdded(_token);
    }

    /**
     * @notice Checks if queue for particular token was created.
     * @param _token Address of the token.
     * @return bool represents whether the queue for a token was created.
     */
    function hasToken(address _token) public view returns (bool) {
        return address(exitsQueues[_token]) != address(0);
    }

    /**
     * @notice Enqueue exits from exit game contracts
     * @dev Caller of this function should add "pragma experimental ABIEncoderV2;" on top of file
     * @param _token Token for the exit
     * @param _exitableAt The earliest time that such exit can be processed
     * @param _txPos Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position.
     * @param _exitId Id for the exit processor contract to understand how to process such exit
     * @param _exitProcessor The exit processor contract that would be called during "processExits"
     * @return a unique priority number computed for the exit
     */
    function enqueue(address _token, uint64 _exitableAt, TxPosLib.TxPos calldata _txPos, uint192 _exitId, IExitProcessor _exitProcessor)
        external
        onlyFromNonQuarantinedExitGame
        returns (uint256)
    {
        require(hasToken(_token), "Such token has not been added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_token];

        uint256 uniquePriority = ExitPriority.computePriority(_exitableAt, _txPos, exitQueueNonce);
        exitQueueNonce++;

        queue.insert(uniquePriority);

        exits[uniquePriority] = Exit({
            exitProcessor: _exitProcessor,
            exitId: _exitId
        });

        emit ExitQueued(_exitId, uniquePriority);

        return uniquePriority;
    }

    /**
     * @notice Processes any exits that have completed the challenge period.
     * @param _token Token type to process.
     * @param _topUniquePriority Unique priority of the first exit that should be processed. Set to zero to skip the check.
     * @param _maxExitsToProcess Maximal number of exits to process.
     * @return total number of processed exits
     */
    function processExits(address _token, uint256 _topUniquePriority, uint256 _maxExitsToProcess) external {
        require(hasToken(_token), "Such token has not be added to the plasma framework yet");

        PriorityQueue queue = exitsQueues[_token];
        require(queue.currentSize() > 0, "Exit queue is empty");

        uint256 uniquePriority = queue.getMin();
        require(_topUniquePriority == 0 || uniquePriority == _topUniquePriority,
            "Top unique priority of the queue is not the same as the specified one");

        Exit memory exit = exits[uniquePriority];
        uint256 processedNum = 0;

        while (processedNum < _maxExitsToProcess && ExitPriority.parseExitableAt(uniquePriority) < block.timestamp) {
            IExitProcessor processor = exit.exitProcessor;

            processor.processExit(exit.exitId);

            delete exits[uniquePriority];
            queue.delMin();
            processedNum++;

            if (queue.currentSize() == 0) {
                break;
            }

            uniquePriority = queue.getMin();
            exit = exits[uniquePriority];
        }

        emit ProcessedExitsNum(processedNum, _token);
    }

    /**
     * @notice Checks if any of the output with the given outputIds is spent already.
     * @param _outputIds Output ids to be checked.
     */
    function isAnyOutputsSpent(bytes32[] calldata _outputIds) external view returns (bool) {
        for (uint i = 0; i < _outputIds.length; i++) {
            if (isOutputSpent[_outputIds[i]] == true) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Batch flags outputs that is spent
     * @param _outputIds Output ids to be flagged
     */
    function batchFlagOutputsSpent(bytes32[] calldata _outputIds) external onlyFromNonQuarantinedExitGame {
        for (uint i = 0; i < _outputIds.length; i++) {
            isOutputSpent[_outputIds[i]] = true;
        }
    }

    /**
     * @notice Flags a single outputs as spent
     * @param _outputId The output id to be flagged as spent
     */
    function flagOutputSpent(bytes32 _outputId) external onlyFromNonQuarantinedExitGame {
        isOutputSpent[_outputId] = true;
    }

    function getNextExit(address _token) external view returns (uint256) {
        return exitsQueues[_token].getMin();
    }
}

// File: contracts/src/framework/PlasmaFramework.sol

pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;






contract PlasmaFramework is Operated, VaultRegistry, ExitGameRegistry, ExitGameController, BlockController {
    uint256 public constant CHILD_BLOCK_INTERVAL = 1000;

    // NOTE: this is the "middle" period.
    // Exit period for fresh utxos is double of that while IFE phase is half of that
    uint256 public minExitPeriod;

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneVaults, uint256 _initialImmuneExitGames)
        public
        BlockController(CHILD_BLOCK_INTERVAL, _minExitPeriod, _initialImmuneVaults)
        ExitGameController(_minExitPeriod, _initialImmuneExitGames)
    {
        minExitPeriod = _minExitPeriod;
    }
}

// File: contracts/src/vaults/Vault.sol

pragma solidity 0.5.11;




contract Vault is Operated {
    event SetDepositVerifierCalled(address nextDepositVerifier);
    PlasmaFramework internal framework;
    bytes32[16] internal zeroHashes;

    /**
     * @notice Stores deposit verifier contracts addresses where first was effective upto
     *  `newDepositVerifierMaturityTimestamp` point of time and second become effective after
    */
    address[2] public depositVerifiers;
    uint256 public newDepositVerifierMaturityTimestamp = 2 ** 255; // point far in the future

    constructor(PlasmaFramework _framework) public {
        framework = _framework;
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    modifier onlyFromNonQuarantinedExitGame() {
        require(
            ExitGameRegistry(framework).isExitGameSafeToUse(msg.sender),
            "Called from a nonregistered or quarantined Exit Game contract"
        );
        _;
    }

    function _submitDepositBlock(bytes memory _depositTx) internal returns (uint256) {
        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        uint256 depositBlkNum = framework.submitDepositBlock(root);
        return depositBlkNum;
    }

    /**
     * @notice Sets the deposit verifier contract. This can be only called by the operator.
     * @notice When one contract is already set next will be effective after MIN_EXIT_PERIOD.
     * @param _verifier address of the verifier contract.
     */
    function setDepositVerifier(address _verifier) public onlyOperator {
        require(_verifier != address(0), "Cannot set an empty address as deposit verifier");

        if (depositVerifiers[0] != address(0)) {
            depositVerifiers[0] = getEffectiveDepositVerifier();
            depositVerifiers[1] = _verifier;
            newDepositVerifierMaturityTimestamp = now + framework.minExitPeriod();

            emit SetDepositVerifierCalled(depositVerifiers[1]);
        } else {
            depositVerifiers[0] = _verifier;
        }
    }

    /**
     * @notice Gets currently effective deposit verifier contract address.
     * @return contract address of deposit verifier.
     */
    function getEffectiveDepositVerifier() public view returns (address) {
        if (now > newDepositVerifierMaturityTimestamp) {
            return depositVerifiers[1];
        } else {
            return depositVerifiers[0];
        }
    }
}

// File: contracts/src/vaults/verifiers/IEthDepositVerifier.sol

pragma solidity 0.5.11;

interface IEthDepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _amount The amount being of the deposited.
     * @param _sender The owner of the deposit transaction.
     */
    function verify(bytes calldata _depositTx, uint256 _amount, address _sender) external view;
}

// File: contracts/src/vaults/EthVault.sol

pragma solidity 0.5.11;




contract EthVault is Vault {
    event EthWithdrawn(
        address payable indexed target,
        uint256 amount
    );

    event DepositCreated(
        address indexed depositor,
        uint256 indexed blknum,
        address indexed token,
        uint256 amount
    );

    constructor(PlasmaFramework _framework) public Vault(_framework) {}

    /**
     * @notice Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        IEthDepositVerifier(getEffectiveDepositVerifier()).verify(_depositTx, msg.value, msg.sender);
        uint256 blknum = super._submitDepositBlock(_depositTx);

        emit DepositCreated(msg.sender, blknum, address(0), msg.value);
    }

    /**
    * @notice Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external onlyFromNonQuarantinedExitGame {
        _target.transfer(_amount);
        emit EthWithdrawn(_target, _amount);
    }
}
