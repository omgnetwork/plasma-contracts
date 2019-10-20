


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

contract VaultRegistryMock is VaultRegistry {
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneVaults)
        public
        VaultRegistry(_minExitPeriod, _initialImmuneVaults)
    {
    }

    function checkOnlyFromNonQuarantinedVault() public onlyFromNonQuarantinedVault view returns (bool) {
        return true;
    }
}

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



contract ExitGameRegistryMock is ExitGameRegistry {
    constructor (uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameRegistry(_minExitPeriod, _initialImmuneExitGames)
    {
    }

    function checkOnlyFromNonQuarantinedExitGame() public onlyFromNonQuarantinedExitGame view returns (bool) {
        return true;
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


library BlockModel {
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }
}





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


interface IErc20DepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _sender The owner of the deposit transaction.
     * @param _vault The address of the Erc20Vault contract.
     */
    function verify(bytes calldata _depositTx, address _sender, address _vault)
        external
        view
        returns (address owner, address token, uint256 amount);
}


/**
 * @dev Interface of the ERC20 standard as defined in the EIP. Does not include
 * the optional functions; to access them see `ERC20Detailed`.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through `transferFrom`. This is
     * zero by default.
     *
     * This value changes when `approve` or `transferFrom` are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * > Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an `Approval` event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to `approve`. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @dev Collection of functions related to the address type,
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * This test is non-exhaustive, and there may be false-negatives: during the
     * execution of a contract's constructor, its address will be reported as
     * not containing a contract.
     *
     * > It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies in extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }
}





/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for ERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using SafeMath for uint256;
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        // solhint-disable-next-line max-line-length
        require((value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(value);
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).sub(value);
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves.

        // A Solidity high level call has three parts:
        //  1. The target address is checked to verify it contains contract code
        //  2. The call itself is made, and success asserted
        //  3. The return value is decoded, which in turn checks the size of the returned data.
        // solhint-disable-next-line max-line-length
        require(address(token).isContract(), "SafeERC20: call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeERC20: low-level call failed");

        if (returndata.length > 0) { // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}







contract Erc20Vault is Vault {
    using SafeERC20 for IERC20;

    event Erc20Withdrawn(
        address payable indexed target,
        address indexed token,
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
     * @notice Deposits approved amount of ERC20 token. Approve must have been called first.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external {
        (address owner, address token, uint256 amount) = IErc20DepositVerifier(getEffectiveDepositVerifier())
            .verify(_depositTx, msg.sender, address(this));

        IERC20(token).safeTransferFrom(owner, address(this), amount);

        uint256 blknum = super._submitDepositBlock(_depositTx);

        emit DepositCreated(msg.sender, blknum, token, amount);
    }

    /**
    * @notice Withdraw plasma chain ERC20 tokens to target
    * @param _target Place to transfer eth.
    * @param _token Address of ERC20 token contract.
    * @param _amount Amount to transfer.
    */
    function withdraw(address payable _target, address _token, uint256 _amount) external onlyFromNonQuarantinedExitGame {
        IERC20(_token).safeTransfer(_target, _amount);
        emit Erc20Withdrawn(_target, _token, _amount);
    }
}


interface IEthDepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _amount The amount being of the deposited.
     * @param _sender The owner of the deposit transaction.
     */
    function verify(bytes calldata _depositTx, uint256 _amount, address _sender) external view;
}




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








contract DummyExitGame is IExitProcessor {
    uint256 public uniquePriorityFromEnqueue;

    ExitGameRegistryMock public exitGameRegistry;
    ExitGameController public exitGameController;
    EthVault public ethVault;
    Erc20Vault public erc20Vault;

    event ExitFinalizedFromDummyExitGame (
        uint256 indexed exitId
    );

    // override ExitProcessor interface
    function processExit(uint192 _exitId) public {
        emit ExitFinalizedFromDummyExitGame(_exitId);
    }

    // setter function only for test, not a real Exit Game function
    function setExitGameRegistry(address _contract) public {
        exitGameRegistry = ExitGameRegistryMock(_contract);
    }

    function checkOnlyFromNonQuarantinedExitGame() public view returns (bool) {
        return exitGameRegistry.checkOnlyFromNonQuarantinedExitGame();
    }

    // setter function only for test, not a real Exit Game function
    function setExitGameController(address _contract) public {
        exitGameController = ExitGameController(_contract);
    }

    function enqueue(address _token, uint64 _exitableAt, uint256 _txPos, uint192 _exitId, IExitProcessor _exitProcessor) public {
        uniquePriorityFromEnqueue = exitGameController.enqueue(_token, _exitableAt, TxPosLib.TxPos(_txPos), _exitId, _exitProcessor);
    }

    function proxyBatchFlagOutputsSpent(bytes32[] memory _outputIds) public {
        exitGameController.batchFlagOutputsSpent(_outputIds);
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        exitGameController.flagOutputSpent(_outputId);
    }

    // setter function only for test, not a real Exit Game function
    function setEthVault(EthVault _vault) public {
        ethVault = _vault;
    }

    function proxyEthWithdraw(address payable _target, uint256 _amount) public {
        ethVault.withdraw(_target, _amount);
    }

    // setter function only for test, not a real Exit Game function
    function setErc20Vault(Erc20Vault _vault) public {
        erc20Vault = _vault;
    }

    function proxyErc20Withdraw(address payable _target, address _token, uint256 _amount) public {
        erc20Vault.withdraw(_target, _token, _amount);
    }
}




contract DummyVault {
    VaultRegistryMock internal vaultRegistry;
    BlockController internal blockController;

    // setter function only for test, not a real Vault function
    function setVaultRegistry(address _contract) public {
        vaultRegistry = VaultRegistryMock(_contract);
    }

    function checkOnlyFromNonQuarantinedVault() public view returns (bool) {
        return vaultRegistry.checkOnlyFromNonQuarantinedVault();
    }

    // setter function only for test, not a real Vault function
    function setBlockController(address _contract) public {
        blockController = BlockController(_contract);
    }

    function submitDepositBlock(bytes32 _blockRoot) public {
        blockController.submitDepositBlock(_blockRoot);
    }
}



/**
 * @title PriorityQueue
 * @dev Min-heap priority queue implementation.
 */
contract PriorityQueueTest{

    /*
     * Events
     */

    event DelMin(uint256 val);

    /*
     *  Storage
     */

    PriorityQueue queue;

    /*
     *  Public functions
     */

    constructor()
        public
    {
        queue = new PriorityQueue();
    }

    /**
     * @dev Inserts an element into the queue. Does not perform deduplication.
     */
    function insert(uint256 _element)
        public
    {
        queue.insert(_element);
    }


    /**
     * @dev Overrides the default implementation, by simply emitting an even on deletion, so that the result is testable.
     * @return The smallest element in the priority queue.
     */
    function delMin()
        public
        returns (uint256 value)
    {
        value = queue.delMin();
        emit DelMin(value);
    }


    /*
     * Read-only functions
     */

    /**
     * @dev Returns the top element of the heap.
     * @return The smallest element in the priority queue.
     */
    function getMin()
        public
        view
        returns (uint256)
    {
        return queue.getMin();
    }

    function currentSize()
        external
        view
        returns (uint256)
    {
        return queue.currentSize();
    }
}


contract OperatedMock is Operated {
    bool public operatorCheckPassed;

    constructor() public {
        operatorCheckPassed = false;
    }

    function checkOnlyOperator() public onlyOperator {
        operatorCheckPassed = true;
    }
}



contract ExitPriorityWrapper {
    function computePriority(uint64 exitableAt, uint256 txPos, uint64 nonce) public pure returns (uint256) {
        return ExitPriority.computePriority(exitableAt, TxPosLib.TxPos(txPos), nonce);
    }

    function parseExitableAt(uint256 priority) public pure returns (uint64) {
        return ExitPriority.parseExitableAt(priority);
    }
}



contract ProtocolWrapper {
    function isValidProtocol(uint8 protocol) public pure returns (bool) {
        return Protocol.isValidProtocol(protocol);
    }
}


library AddressPayable {

    /**
     * @notice Converts an `address` into `address payable`.
     * @dev Note that this is simply a type cast: the actual underlying value is not changed.
     */
    function convert(address account) internal pure returns (address payable) {
        return address(uint160(account));
    }
}



contract AddressPayableWrapper {

    function convert(address _address)
        public
        pure
        returns (address payable)
    {
        return AddressPayable.convert(_address);
    }
}


/**
 * @title Bits
 * @dev Operations on individual bits of a word.
 */
library Bits {
    /*
     * Storage
     */

    uint constant internal ONE = uint(1);

    /*
     * Internal functions
     */
    /**
     * @dev Sets the bit at the given '_index' in '_self' to '1'.
     * @param _self Uint to modify.
     * @param _index Index of the bit to set.
     * @return The modified value.
     */
    function setBit(uint _self, uint8 _index)
        internal
        pure
        returns (uint)
    {
        return _self | ONE << _index;
    }

    /**
     * @dev Sets the bit at the given '_index' in '_self' to '0'.
     * @param _self Uint to modify.
     * @param _index Index of the bit to set.
     * @return The modified value.
     */
    function clearBit(uint _self, uint8 _index)
        internal
        pure
        returns (uint)
    {
        return _self & ~(ONE << _index);
    }

    /**
     * @dev Returns the bit at the given '_index' in '_self'.
     * @param _self Uint to check.
     * @param _index Index of the bit to get.
     * @return The value of the bit at '_index'.
     */
    function getBit(uint _self, uint8 _index)
        internal
        pure
        returns (uint8)
    {
        return uint8(_self >> _index & 1);
    }

    /**
     * @dev Checks if the bit at the given '_index' in '_self' is '1'.
     * @param _self Uint to check.
     * @param _index Index of the bit to check.
     * @return True if the bit is '0'. False otherwise.
     */
    function bitSet(uint _self, uint8 _index)
        internal
        pure
        returns (bool)
    {
        return getBit(_self, _index) == 1;
    }
}



contract BitsWrapper {
    function setBit(uint _self, uint8 _index) public pure returns (uint)
    {
        return Bits.setBit(_self, _index);
    }

    function clearBit(uint _self, uint8 _index) public pure returns (uint)
    {
        return Bits.clearBit(_self, _index);
    }

    /**
     * @dev It makes sense to expose just `bitSet` to be able to test both of Bits `getBit` and `bitSet`
     */
    function bitSet(uint _self, uint8 _index) public pure returns (bool)
    {
        return Bits.bitSet(_self, _index);
    }
}


/**
 * @notice Stores an updateable bond size.
 */
library BondSize {
    uint64 constant public WAITING_PERIOD = 2 days;

    struct Params {
        uint128 previousBondSize;
        uint128 updatedBondSize;
        uint128 effectiveUpdateTime;
        uint16 lowerBoundDivisor;
        uint16 upperBoundMultiplier;
    }

    function buildParams(uint128 _initialBondSize, uint16 _lowerBoundDivisor, uint16 _upperBoundMultiplier)
        internal
        pure
        returns (Params memory)
    {
        return Params({
            previousBondSize: _initialBondSize,
            updatedBondSize: 0,
            effectiveUpdateTime: 2 ** 63, // Initial waiting period is far in the future
            lowerBoundDivisor: _lowerBoundDivisor,
            upperBoundMultiplier: _upperBoundMultiplier
        });
    }

    /**
    * @notice Updates the bond size.
    * @notice The new value is bounded by 0.5 and 2x of current bond size.
    * @notice There is a waiting period of 2 days before the new value goes into effect.
    * @param newBondSize the new bond size.
    */
    function updateBondSize(Params storage _self, uint128 newBondSize) internal {
        validateBondSize(_self, newBondSize);

        if (_self.updatedBondSize != 0 && now > _self.effectiveUpdateTime) {
            _self.previousBondSize = _self.updatedBondSize;
        }
        _self.updatedBondSize = newBondSize;
        _self.effectiveUpdateTime = uint64(now) + WAITING_PERIOD;
    }

    /**
    * @notice Returns the current bond size.
    */
    function bondSize(Params memory _self) internal view returns (uint128) {
        if (now < _self.effectiveUpdateTime) {
            return _self.previousBondSize;
        } else {
            return _self.updatedBondSize;
        }
    }

    function validateBondSize(Params memory _self, uint128 newBondSize) private view {
        uint128 currentBondSize = bondSize(_self);
        require(newBondSize >= currentBondSize / _self.lowerBoundDivisor, "Bond size is too low");
        require(newBondSize <= currentBondSize * _self.upperBoundMultiplier, "Bond size is too high");
    }
}



contract BondSizeMock {
    using BondSize for BondSize.Params;

    BondSize.Params public bond;

    constructor (uint128 _initialBondSize, uint16 _lowerBoundDivisor, uint16 _upperBoundMultiplier) public {
        bond = BondSize.buildParams(_initialBondSize, _lowerBoundDivisor, _upperBoundMultiplier);
    }

    function bondSize() public view returns (uint128) {
        return bond.bondSize();
    }

    function updateBondSize(uint128 newBondSize) public {
        bond.updateBondSize(newBondSize);
    }
}


/**
 * @title Merkle
 * @dev Library for working with Merkle trees.
 */
library Merkle {

    /**
     * @notice Checks that a leaf hash is contained in a root hash.
     * @param leaf Leaf hash to verify.
     * @param index Position of the leaf hash in the Merkle tree.
     * @param rootHash Root of the Merkle tree.
     * @param proof A Merkle proof demonstrating membership of the leaf hash.
     * @return True of the leaf hash is in the Merkle tree. False otherwise.
    */
    function checkMembership(bytes32 leaf, uint256 index, bytes32 rootHash, bytes memory proof)
        internal
        pure
        returns (bool)
    {
        require(proof.length % 32 == 0, "Length of merkle proof must be a multiple of of 32.");

        bytes32 proofElement;
        bytes32 computedHash = leaf;
        uint256 j = index;
        // NOTE: we're skipping the first 32 bytes of `proof`, which holds the size of the dynamically sized `bytes`
        for (uint256 i = 32; i <= proof.length; i += 32) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                proofElement := mload(add(proof, i))
            }
            if (j % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            j = j / 2;
        }

        return computedHash == rootHash;
    }
}

contract MerkleWrapper {

    function checkMembership(bytes32 leaf, uint256 index, bytes32 rootHash, bytes memory proof)
        public
        pure
        returns (bool)
    {
        return Merkle.checkMembership(leaf, index, rootHash, proof);
    }
}



/**
@dev UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
 */
library UtxoPosLib {
    struct UtxoPos {
        uint256 value;
    }

    uint256 constant internal BLOCK_OFFSET = 1000000000;
    uint256 constant internal TX_OFFSET = 10000;

    /**
     * @notice Given txPos and outputIndex, returns the Utxo struct.
     * @param txPos tx position
     * @param outputIndex the output's transaction index.
     * @return UtxoPos of the according value
     */
    function build(TxPosLib.TxPos memory txPos, uint16 outputIndex)
        internal
        pure
        returns (UtxoPos memory)
    {
        return UtxoPos(txPos.value * TX_OFFSET + outputIndex);
    }

    /**
     * @notice Given an UTXO position, returns the block number.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The output's block number.
     */
    function blockNum(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return _utxoPos.value / BLOCK_OFFSET;
    }

    /**
     * @notice Given an UTXO position, returns the transaction index.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The output's transaction index.
     */
    function txIndex(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint256)
    {
        return (_utxoPos.value % BLOCK_OFFSET) / TX_OFFSET;
    }

    /**
     * @notice Given an UTXO position, returns the output index.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The output's index.
     */
    function outputIndex(UtxoPos memory _utxoPos)
        internal
        pure
        returns (uint16)
    {
        return uint16(_utxoPos.value % TX_OFFSET);
    }

    /**
     * @notice Given an UTXO position, returns transaction position.
     * @param _utxoPos Output identifier in form of utxo position.
     * @return The transaction position.
     */
    function txPos(UtxoPos memory _utxoPos)
        internal
        pure
        returns (TxPosLib.TxPos memory)
    {
        return TxPosLib.TxPos(_utxoPos.value / TX_OFFSET);
    }
}




contract UtxoPosLibWrapper {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    function build(uint256 txPos, uint16 outputIndex) public pure returns (UtxoPosLib.UtxoPos memory) {
        return UtxoPosLib.build(TxPosLib.TxPos(txPos), outputIndex);
    }

    function blockNum(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).blockNum();
    }

    function txIndex(uint256 _utxoPos) public pure returns (uint256) {
        return UtxoPosLib.UtxoPos(_utxoPos).txIndex();
    }

    function outputIndex(uint256 _utxoPos) public pure returns (uint16) {
        return UtxoPosLib.UtxoPos(_utxoPos).outputIndex();
    }

    function txPos(uint256 _utxoPos) public pure returns (TxPosLib.TxPos memory) {
        return UtxoPosLib.UtxoPos(_utxoPos).txPos();
    }
}



/**
 * @title RLP
 * @dev Library for RLP decoding.
 * Based off of https://github.com/androlo/standard-contracts/blob/master/contracts/src/codec/RLP.sol.
 */
library RLP {
    /*
     * Storage
     */

    uint internal constant DATA_SHORT_START = 0x80;
    uint internal constant DATA_LONG_START = 0xB8;
    uint internal constant LIST_SHORT_START = 0xC0;
    uint internal constant LIST_LONG_START = 0xF8;

    uint internal constant DATA_LONG_OFFSET = 0xB7;
    uint internal constant LIST_LONG_OFFSET = 0xF7;

    struct RLPItem {
        uint _unsafeMemPtr;    // Pointer to the RLP-encoded bytes.
        uint _unsafeLength;    // Number of bytes. This is the full length of the string.
    }

    struct Iterator {
        RLPItem _unsafeItem;   // Item that's being iterated over.
        uint _unsafeNextPtr;   // Position of the next item in the list.
    }

    /*
     * Internal functions
     */
    /**
     * @dev Creates an RLPItem from an array of RLP encoded bytes.
     * @param self The RLP encoded bytes.
     * @return An RLPItem.
     */
    function toRLPItem(bytes memory self)
        internal
        pure
        returns (RLPItem memory)
    {
        uint len = self.length;
        if (len == 0) {
            return RLPItem(0, 0);
        }
        uint memPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            memPtr := add(self, 0x20)
        }
        return RLPItem(memPtr, len);
    }

    /**
     * @dev Creates an RLPItem from an array of RLP encoded bytes.
     * @param self The RLP encoded bytes.
     * @param strict Will throw if the data is not RLP encoded.
     * @return An RLPItem
     */
    function toRLPItem(bytes memory self, bool strict)
        internal
        pure
        returns (RLPItem memory)
    {
        RLPItem memory item = toRLPItem(self);
        if (strict) {
            uint len = self.length;
            require(_payloadOffset(item) <= len, "Invalid RLP encoding - Payload offset to big");
            require(_itemLength(item._unsafeMemPtr) == len, "Invalid RLP encoding - Implied item length does not match encoded length");
            require(_validate(item), "Invalid RLP encoding");
        }
        return item;
    }

    /**
     * @dev Check if the RLP item is null.
     * @param self The RLP item.
     * @return 'true' if the item is null.
     */
    function isNull(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        return self._unsafeLength == 0;
    }

    /**
     * @dev Check if the RLP item is a list.
     * @param self The RLP item.
     * @return 'true' if the item is a list.
     */
    function isList(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        if (self._unsafeLength == 0) {
            return false;
        }
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ret := iszero(lt(byte(0, mload(memPtr)), 0xC0))
        }
    }

    /**
     * @dev Check if the RLP item is data.
     * @param self The RLP item.
     * @return 'true' if the item is data.
     */
    function isData(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        if (self._unsafeLength == 0) {
            return false;
        }
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ret := lt(byte(0, mload(memPtr)), 0xC0)
        }
    }

    /**
     * @dev Check if the RLP item is empty (string or list).
     * @param self The RLP item.
     * @return 'true' if the item is null.
     */
    function isEmpty(RLPItem memory self)
        internal
        pure
        returns (bool ret)
    {
        if (isNull(self)) {
            return false;
        }
        uint b0;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        return (b0 == DATA_SHORT_START || b0 == LIST_SHORT_START);
    }

    /**
     * @dev Get the number of items in an RLP encoded list.
     * @param self The RLP item.
     * @return The number of items.
     */
    function items(RLPItem memory self)
        internal
        pure
        returns (uint)
    {
        if (!isList(self)) {
            return 0;
        }
        uint b0;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        uint pos = memPtr + _payloadOffset(self);
        uint last = memPtr + self._unsafeLength - 1;
        uint itms;
        while (pos <= last) {
            pos += _itemLength(pos);
            itms++;
        }
        return itms;
    }

    /**
     * @dev Create an iterator.
     * @param self The RLP item.
     * @return An 'Iterator' over the item.
     */
    function iterator(RLPItem memory self)
        internal
        pure
        returns (Iterator memory it)
    {
        require(isList(self), "Item is not a list");
        uint ptr = self._unsafeMemPtr + _payloadOffset(self);
        it._unsafeItem = self;
        it._unsafeNextPtr = ptr;
    }

    /**
     * @dev Decode an RLPItem into bytes. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toData(RLPItem memory self)
        internal
        pure
        returns (bytes memory bts)
    {
        require(isData(self), "Item is not data");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        bts = new bytes(len);
        _copyToBytes(rStartPos, bts, len);
    }

    /**
     * @dev Get the list of sub-items from an RLP encoded list.
     * Warning: This is inefficient, as it requires that the list is read twice.
     * @param self The RLP item.
     * @return Array of RLPItems.
     */
    function toList(RLPItem memory self)
        internal
        pure
        returns (RLPItem[] memory list)
    {
        require(isList(self), "Item is not a list");
        uint numItems = items(self);
        list = new RLPItem[](numItems);
        Iterator memory it = iterator(self);
        uint idx;
        while (_hasNext(it)) {
            list[idx] = _next(it);
            idx++;
        }
    }

    /**
     * @dev Decode an RLPItem into an ascii string. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toAscii(RLPItem memory self)
        internal
        pure
        returns (string memory str)
    {
        require(isData(self), "These are not RLP encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        bytes memory bts = new bytes(len);
        _copyToBytes(rStartPos, bts, len);
        str = string(bts);
    }

    /**
     * @dev Decode an RLPItem into a uint. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toUint(RLPItem memory self)
        internal
        pure
        returns (uint data)
    {
        require(isData(self), "These are not RLP encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len <= 32, "These are not RLP encoded bytes32");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            data := div(mload(rStartPos), exp(256, sub(32, len)))
        }
    }

    /**
     * @dev Decode an RLPItem into a boolean. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toBool(RLPItem memory self)
        internal
        pure
        returns (bool data)
    {
        require(isData(self), "These are not RLP encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len == 1, "These are not RLP encoded bytes");
        uint temp;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            temp := byte(0, mload(rStartPos))
        }
        require(temp <= 1, "These are not RLP encoded bytes");
        return temp == 1 ? true : false;
    }

    /**
     * @dev Decode an RLPItem into a byte. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toByte(RLPItem memory self)
        internal
        pure
        returns (byte data)
    {
        require(isData(self), "These are not RLP encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len == 1, "These are not RLP encoded bytes");
        uint temp;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            temp := byte(0, mload(rStartPos))
        }
        return byte(uint8(temp));
    }

    /**
     * @dev Decode an RLPItem into an int. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toInt(RLPItem memory self)
        internal
        pure
        returns (int data)
    {
        return int(toUint(self));
    }

    /**
     * @dev Decode an RLPItem into a bytes32. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toBytes32(RLPItem memory self)
        internal
        pure
        returns (bytes32 data)
    {
        return bytes32(toUint(self));
    }

    /**
     * @dev Decode an RLPItem into an address. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toAddress(RLPItem memory self)
        internal
        pure
        returns (address data)
    {
        require(isData(self), "These are not RLP encoded bytes");
        uint rStartPos;
        uint len;
        (rStartPos, len) = _decode(self);
        require(len == 20, "These are not RLP encoded bytes");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            data := div(mload(rStartPos), exp(256, 12))
        }
    }

    /**
     * @dev Decode an RLPItem into a bytes20. This will not work if the RLPItem is a list.
     * @param self The RLPItem.
     * @return The decoded string.
     */
    function toBytes20(RLPItem memory self)
        internal
        pure
        returns (bytes20 data)
    {
        return bytes20(toAddress(self));
    }

    /*
     * Private functions
     */
    /**
     * @dev Returns the next RLP item for some iterator.
     * @param self The iterator.
     * @return The next RLP item.
     */
    function _next(Iterator memory self)
        private
        pure
        returns (RLPItem memory subItem)
    {
        require(_hasNext(self), "These are not RLP encoded bytes");
        uint ptr = self._unsafeNextPtr;
        uint itemLength = _itemLength(ptr);
        subItem._unsafeMemPtr = ptr;
        subItem._unsafeLength = itemLength;
        self._unsafeNextPtr = ptr + itemLength;
    }

    /**
     * @dev Returns the next RLP item for some iterator and validates it.
     * @param self The iterator.
     * @return The next RLP item.
     */
    function _next(Iterator memory self, bool strict)
        private
        pure
        returns (RLPItem memory subItem)
    {
        subItem = _next(self);
        require(!strict || _validate(subItem), "These are not RLP encoded bytes");
        return subItem;
    }

    /**
     * @dev Checks if an iterator has a next RLP item.
     * @param self The iterator.
     * @return True if the iterator has an RLP item. False otherwise.
     */
    function _hasNext(Iterator memory self)
        private
        pure
        returns (bool)
    {
        RLPItem memory item = self._unsafeItem;
        return self._unsafeNextPtr < item._unsafeMemPtr + item._unsafeLength;
    }

    /**
     * @dev Determines the payload offset of some RLP item.
     * @param self RLP item to query.
     * @return The payload offset for that item.
     */
    function _payloadOffset(RLPItem memory self)
        private
        pure
        returns (uint)
    {
        if (self._unsafeLength == 0) {
            return 0;
        }
        uint b0;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        if (b0 < DATA_SHORT_START) {
            return 0;
        }
        if (b0 < DATA_LONG_START || (b0 >= LIST_SHORT_START && b0 < LIST_LONG_START)) {
            return 1;
        }
        if (b0 < LIST_SHORT_START) {
            return b0 - DATA_LONG_OFFSET + 1;
        }
        return b0 - LIST_LONG_OFFSET + 1;
    }

    /**
     * @dev Determines the length of an RLP item.
     * @param memPtr Pointer to the start of the item.
     * @return Length of the item.
     */
    function _itemLength(uint memPtr)
        private
        pure
        returns (uint len)
    {
        uint b0;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
        }
        if (b0 < DATA_SHORT_START) {
            len = 1;
        } else if (b0 < DATA_LONG_START) {
            len = b0 - DATA_SHORT_START + 1;
        } else if (b0 < LIST_SHORT_START) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let bLen := sub(b0, 0xB7) // bytes length (DATA_LONG_OFFSET)
                let dLen := div(mload(add(memPtr, 1)), exp(256, sub(32, bLen))) // data length
                len := add(1, add(bLen, dLen)) // total length
            }
        } else if (b0 < LIST_LONG_START) {
            len = b0 - LIST_SHORT_START + 1;
        } else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let bLen := sub(b0, 0xF7) // bytes length (LIST_LONG_OFFSET)
                let dLen := div(mload(add(memPtr, 1)), exp(256, sub(32, bLen))) // data length
                len := add(1, add(bLen, dLen)) // total length
            }
        }
    }

    /**
     * @dev Determines the start position and length of some RLP item.
     * @param self RLP item to query.
     * @return A pointer to the beginning of the item and the length of that item.
     */
    function _decode(RLPItem memory self)
        private
        pure
        returns (uint memPtr, uint len)
    {
        require(isData(self), "These are not RLP encoded bytes");
        uint b0;
        uint start = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(start))
        }
        if (b0 < DATA_SHORT_START) {
            return (start, 1);
        }
        if (b0 < DATA_LONG_START) {
            len = self._unsafeLength - 1;
            memPtr = start + 1;
        } else {
            uint bLen;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                bLen := sub(b0, 0xB7) // DATA_LONG_OFFSET
            }
            len = self._unsafeLength - 1 - bLen;
            memPtr = start + bLen + 1;
        }
        return (memPtr, len);
    }

    /**
     * @dev Copies some data to a certain target.
     * @param btsPtr Pointer to the data to copy.
     * @param tgt Place to copy.
     * @param btsLen How many bytes to copy.
     */
    function _copyToBytes(uint btsPtr, bytes memory tgt, uint btsLen)
        private
        pure
    {
        // Exploiting the fact that 'tgt' was the last thing to be allocated,
        // we can write entire words, and just overwrite any excess.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            {
                let i := 0
                let words := div(add(btsLen, 31), 32)
                let rOffset := btsPtr
                let wOffset := add(tgt, 0x20)
                for { } lt(i, words) { } {
                    let offset := mul(i, 0x20)
                    mstore(add(wOffset, offset), mload(add(rOffset, offset)))
                    i := add(i, 1)
                }
                mstore(add(tgt, add(0x20, mload(tgt))), 0)
            }
        }
    }

    /**
     * @dev Checks that an RLP item is valid.
     * @param self RLP item to validate.
     * @return True if the RLP item is well-formed. False otherwise.
     */
    function _validate(RLPItem memory self)
        private
        pure
        returns (bool ret)
    {
        // Check that RLP is well-formed.
        uint b0;
        uint b1;
        uint memPtr = self._unsafeMemPtr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            b0 := byte(0, mload(memPtr))
            b1 := byte(1, mload(memPtr))
        }
        if (b0 == DATA_SHORT_START + 1 && b1 < DATA_SHORT_START) {
            return false;
        }
        return true;
    }
}



contract RLPMock {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    function decodeBytes32(bytes memory _data) public pure returns (bytes32) {
        return _data.toRLPItem().toBytes32();
    }

    function decodeBool(bytes memory _data) public pure returns (bool) {
        return _data.toRLPItem().toBool();
    }

    function decodeInt(bytes memory _data) public pure returns (int) {
        return _data.toRLPItem().toInt();
    }

    function decodeUint(bytes memory _data) public pure returns (uint) {
        return _data.toRLPItem().toUint();
    }

    function decodeArray(bytes memory _data) public pure returns (uint) {
        RLP.RLPItem[] memory items = (_data.toRLPItem().toList()[0]).toList();
        return items.length;
    }
}



contract QuarantineMock {
    using Quarantine for Quarantine.Data;
    Quarantine.Data internal _quarantine;

    constructor(uint256 _period, uint256 _initialImmuneCount)
        public
    {
        _quarantine.quarantinePeriod = _period;
        _quarantine.immunitiesRemaining = _initialImmuneCount;
    }

    function quarantineContract(address _contractAddress) public {
        _quarantine.quarantine(_contractAddress);
    }

    function isQuarantined(address _contractAddress) public view returns (bool) {
        return _quarantine.isQuarantined(_contractAddress);
    }
}




/**
 * @title RLPTest
 * @dev Contract for testing RLP decoding.
 */
contract RLPTest {
    function eight(bytes memory tx_bytes)
        public
        view
        returns (uint256, address, address)
    {
        RLP.RLPItem[] memory txList = RLP.toList(RLP.toRLPItem(tx_bytes));
        return (
            RLP.toUint(txList[5]),
            RLP.toAddress(txList[6]),
            RLP.toAddress(txList[7])
        );
    }

    function eleven(bytes memory tx_bytes)
        public
        view
        returns (uint256, address, address, address)
    {
        RLP.RLPItem[] memory  txList = RLP.toList(RLP.toRLPItem(tx_bytes));
        return (
            RLP.toUint(txList[7]),
            RLP.toAddress(txList[8]),
            RLP.toAddress(txList[9]),
            RLP.toAddress(txList[10])
        );
    }
}


library IsDeposit {
    struct Predicate {
        uint256 childBlockInterval;
    }

    function test(Predicate memory _predicate, uint256 _blockNum) internal pure returns (bool) {
        return _blockNum % _predicate.childBlockInterval != 0;
    }
}



contract IsDepositWrapper {
    using IsDeposit for IsDeposit.Predicate;

    IsDeposit.Predicate internal isDeposit;

    constructor(uint256 _childBlockInterval) public {
        isDeposit = IsDeposit.Predicate(_childBlockInterval);
    }

    function test(uint256 _blockNum) public view returns (bool) {
        return isDeposit.test(_blockNum);
    }
}


contract OnlyWithValue {
    modifier onlyWithValue(uint256 _value) {
        require(msg.value == _value, "Input value mismatches with msg.value");
        _;
    }
}



contract OnlyWithValueMock is OnlyWithValue {
    event OnlyWithValuePassed();

    function checkOnlyWithValue(uint256 _value) public payable onlyWithValue(_value) {
        emit OnlyWithValuePassed();
    }
}



contract TxPosLibWrapper {
    using TxPosLib for TxPosLib.TxPos;

    function blockNum(uint256 _txPos) public pure returns (uint256) {
        return TxPosLib.TxPos(_txPos).blockNum();
    }

    function txIndex(uint256 _txPos) public pure returns (uint256) {
        return TxPosLib.TxPos(_txPos).txIndex();
    }
}



/**
 * @dev Implementation of the `IERC20` interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using `_mint`.
 * For a generic mechanism see `ERC20Mintable`.
 *
 * *For a detailed writeup see our guide [How to implement supply
 * mechanisms](https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226).*
 *
 * We have followed general OpenZeppelin guidelines: functions revert instead
 * of returning `false` on failure. This behavior is nonetheless conventional
 * and does not conflict with the expectations of ERC20 applications.
 *
 * Additionally, an `Approval` event is emitted on calls to `transferFrom`.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard `decreaseAllowance` and `increaseAllowance`
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See `IERC20.approve`.
 */
contract ERC20 is IERC20 {
    using SafeMath for uint256;

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;

    /**
     * @dev See `IERC20.totalSupply`.
     */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See `IERC20.balanceOf`.
     */
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See `IERC20.transfer`.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev See `IERC20.allowance`.
     */
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See `IERC20.approve`.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev See `IERC20.transferFrom`.
     *
     * Emits an `Approval` event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of `ERC20`;
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `value`.
     * - the caller must have allowance for `sender`'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount));
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to `approve` that can be used as a mitigation for
     * problems described in `IERC20.approve`.
     *
     * Emits an `Approval` event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to `approve` that can be used as a mitigation for
     * problems described in `IERC20.approve`.
     *
     * Emits an `Approval` event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue));
        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to `transfer`, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a `Transfer` event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(amount);
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a `Transfer` event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

     /**
     * @dev Destoys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a `Transfer` event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 value) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        _totalSupply = _totalSupply.sub(value);
        _balances[account] = _balances[account].sub(value);
        emit Transfer(account, address(0), value);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an `Approval` event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /**
     * @dev Destoys `amount` tokens from `account`.`amount` is then deducted
     * from the caller's allowance.
     *
     * See `_burn` and `_approve`.
     */
    function _burnFrom(address account, uint256 amount) internal {
        _burn(account, amount);
        _approve(account, msg.sender, _allowances[account][msg.sender].sub(amount));
    }
}


/**
 * @title Roles
 * @dev Library for managing addresses assigned to a Role.
 */
library Roles {
    struct Role {
        mapping (address => bool) bearer;
    }

    /**
     * @dev Give an account access to this role.
     */
    function add(Role storage role, address account) internal {
        require(!has(role, account), "Roles: account already has role");
        role.bearer[account] = true;
    }

    /**
     * @dev Remove an account's access to this role.
     */
    function remove(Role storage role, address account) internal {
        require(has(role, account), "Roles: account does not have role");
        role.bearer[account] = false;
    }

    /**
     * @dev Check if an account has this role.
     * @return bool
     */
    function has(Role storage role, address account) internal view returns (bool) {
        require(account != address(0), "Roles: account is the zero address");
        return role.bearer[account];
    }
}



contract MinterRole {
    using Roles for Roles.Role;

    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);

    Roles.Role private _minters;

    constructor () internal {
        _addMinter(msg.sender);
    }

    modifier onlyMinter() {
        require(isMinter(msg.sender), "MinterRole: caller does not have the Minter role");
        _;
    }

    function isMinter(address account) public view returns (bool) {
        return _minters.has(account);
    }

    function addMinter(address account) public onlyMinter {
        _addMinter(account);
    }

    function renounceMinter() public {
        _removeMinter(msg.sender);
    }

    function _addMinter(address account) internal {
        _minters.add(account);
        emit MinterAdded(account);
    }

    function _removeMinter(address account) internal {
        _minters.remove(account);
        emit MinterRemoved(account);
    }
}




/**
 * @dev Extension of `ERC20` that adds a set of accounts with the `MinterRole`,
 * which have permission to mint (create) new tokens as they see fit.
 *
 * At construction, the deployer of the contract is the only minter.
 */
contract ERC20Mintable is ERC20, MinterRole {
    /**
     * @dev See `ERC20._mint`.
     *
     * Requirements:
     *
     * - the caller must have the `MinterRole`.
     */
    function mint(address account, uint256 amount) public onlyMinter returns (bool) {
        _mint(account, amount);
        return true;
    }
}



contract Import {
}





library PaymentOutputModel {

    using RLP for RLP.RLPItem;

    struct Output {
        bytes20 outputGuard;
        address token;
        uint256 amount;
    }

    /**
     * @notice Get the 'owner' from the output with the assumption of
     *         'outputGuard' field directly holding owner's address.
     * @dev 'outputGuard' can potentially be hash of pre-image that holds the owner info.
     *       This should not and cannot be handled here.
     */
    function owner(Output memory _output) internal pure returns (address payable) {
        return AddressPayable.convert(address(uint160(_output.outputGuard)));
    }

    function decode(RLP.RLPItem memory encoded) internal pure returns (Output memory) {
        RLP.RLPItem[] memory rlpEncoded = encoded.toList();
        require(rlpEncoded.length == 3, "Invalid output encoding");

        Output memory output = Output({
            outputGuard: rlpEncoded[0].toBytes20(),
            token: rlpEncoded[1].toAddress(),
            amount: rlpEncoded[2].toUint()
        });

        return output;
    }
}




library PaymentTransactionModel {

    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using PaymentOutputModel for PaymentOutputModel.Output;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    uint8 constant private ENCODED_LENGTH_WITH_METADATA = 4;
    uint8 constant private ENCODED_LENGTH_WITHOUT_METADATA = 3;

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        PaymentOutputModel.Output[] outputs;
        bytes32 metaData;
    }

    function decode(bytes memory _tx) internal pure returns (PaymentTransactionModel.Transaction memory) {
        RLP.RLPItem[] memory rlpTx = _tx.toRLPItem().toList();
        require(
            rlpTx.length == ENCODED_LENGTH_WITH_METADATA || rlpTx.length == ENCODED_LENGTH_WITHOUT_METADATA,
            "Invalid encoding of transaction"
        );

        RLP.RLPItem[] memory rlpInputs = rlpTx[1].toList();
        require(rlpInputs.length <= MAX_INPUT_NUM, "Transaction inputs num exceeds limit");

        RLP.RLPItem[] memory rlpOutputs = rlpTx[2].toList();
        require(rlpOutputs.length <= MAX_OUTPUT_NUM, "Transaction outputs num exceeds limit");

        uint txType = rlpTx[0].toUint();

        bytes32[] memory inputs = new bytes32[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; i++) {
            bytes32 input = rlpInputs[i].toBytes32();
            inputs[i] = input;
        }

        PaymentOutputModel.Output[] memory outputs = new PaymentOutputModel.Output[](rlpOutputs.length);
        for (uint i = 0; i < rlpOutputs.length; i++) {
            PaymentOutputModel.Output memory output = PaymentOutputModel.decode(rlpOutputs[i]);
            outputs[i] = output;
        }

        bytes32 metaData;
        if (rlpTx.length == ENCODED_LENGTH_WITH_METADATA) {
            metaData = rlpTx[3].toBytes32();
        } else {
            metaData = bytes32(0);
        }

        return Transaction({txType: txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }
}





library PaymentEip712Lib {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    bytes2 constant internal EIP191_PREFIX = "\x19\x01";

    bytes32 constant internal EIP712_DOMAIN_HASH = keccak256(
        "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
    );

    bytes32 constant internal TX_TYPE_HASH = keccak256(
        "Transaction(uint256 txType,Input input0,Input input1,Input input2,Input input3,Output output0,Output output1,Output output2,Output output3,bytes32 metadata)Input(uint256 blknum,uint256 txindex,uint256 oindex)Output(bytes32 owner,address currency,uint256 amount)"
    );

    bytes32 constant internal INPUT_TYPE_HASH = keccak256("Input(uint256 blknum,uint256 txindex,uint256 oindex)");
    bytes32 constant internal OUTPUT_TYPE_HASH = keccak256("Output(bytes32 owner,address currency,uint256 amount)");
    bytes32 constant internal SALT = 0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83;

    bytes32 constant internal EMPTY_INPUT_HASH = keccak256(abi.encode(INPUT_TYPE_HASH, 0, 0, 0));
    bytes32 constant internal EMPTY_OUTPUT_HASH = keccak256(abi.encode(OUTPUT_TYPE_HASH, bytes32(""), bytes32(""), 0));

    struct Constants {
        // solhint-disable-next-line var-name-mixedcase
        bytes32 DOMAIN_SEPARATOR; 
    }

    function initConstants(address _verifyingContract) internal pure returns (Constants memory) {
        // solhint-disable-next-line var-name-mixedcase
        bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
            EIP712_DOMAIN_HASH,
            keccak256("OMG Network"),
            keccak256("1"),
            address(_verifyingContract),
            SALT
        ));

        return Constants({
            DOMAIN_SEPARATOR: DOMAIN_SEPARATOR
        });
    }

    function hashTx(Constants memory _eip712, PaymentTransactionModel.Transaction memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            EIP191_PREFIX,
            _eip712.DOMAIN_SEPARATOR,
            _hashTx(_tx)
        ));
    }

    function _hashTx(PaymentTransactionModel.Transaction memory _tx)
        private
        pure
        returns (bytes32)
    {
        // pad empty value to input array
        bytes32[] memory inputs = new bytes32[](MAX_INPUT_NUM);
        for (uint i = 0; i < _tx.inputs.length; i++) {
            inputs[i] = _tx.inputs[i];
        }

        // pad empty value to output array
        PaymentOutputModel.Output[] memory outputs = new PaymentOutputModel.Output[](MAX_OUTPUT_NUM);
        for (uint i = 0; i < _tx.outputs.length; i++) {
            outputs[i] = _tx.outputs[i];
        }

        return keccak256(abi.encode(
            TX_TYPE_HASH,
            _tx.txType,
            _hashInput(inputs[0]),
            _hashInput(inputs[1]),
            _hashInput(inputs[2]),
            _hashInput(inputs[3]),
            _hashOutput(outputs[0]),
            _hashOutput(outputs[1]),
            _hashOutput(outputs[2]),
            _hashOutput(outputs[3]),
            _tx.metaData
        ));
    }

    function _hashInput(bytes32 _input) private pure returns (bytes32) {
        uint256 inputUtxoValue = uint256(_input);
        if (inputUtxoValue == 0) {
            return EMPTY_INPUT_HASH;
        }

        UtxoPosLib.UtxoPos memory utxo = UtxoPosLib.UtxoPos(inputUtxoValue);
        return keccak256(abi.encode(
            INPUT_TYPE_HASH,
            utxo.blockNum(),
            utxo.txIndex(),
            uint256(utxo.outputIndex())
        ));
    }

    function _hashOutput(PaymentOutputModel.Output memory _output)
        private
        pure
        returns (bytes32)
    {
        if (_output.amount == 0) {
            return EMPTY_OUTPUT_HASH;
        }

        return keccak256(abi.encode(
            OUTPUT_TYPE_HASH,
            _output.outputGuard,
            _output.token,
            _output.amount
        ));
    }
}




contract PaymentEip712LibMock {
    function hashTx(address _verifyingContract, bytes memory _rlpTx)
        public
        pure
        returns (bytes32)
    {
        PaymentEip712Lib.Constants memory eip712 = PaymentEip712Lib.initConstants(_verifyingContract);
        return PaymentEip712Lib.hashTx(eip712, PaymentTransactionModel.decode(_rlpTx));
    }
}



/**
 * @title WireTransaction
 * @dev Utility functions for working with transactions in wire format.
 */
library WireTransaction {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    struct Output {
        uint256 amount;
        bytes20 outputGuard;
        address token;
    }

    /**
    * @dev Returns output for transaction in wire format.
    * Outputs is a field on the second index and should be a list where first three elements are: amount, output guard, token.
    */
    function getOutput(bytes memory transaction, uint16 outputIndex) internal pure returns (Output memory) {
        RLP.RLPItem[] memory rlpTx = transaction.toRLPItem().toList();
        RLP.RLPItem[] memory outputs = rlpTx[2].toList();
        require(outputIndex < outputs.length, "Invalid wire transaction format");

        RLP.RLPItem[] memory output = outputs[outputIndex].toList();
        bytes20 outputGuard = bytes20(output[0].toAddress());
        address token = output[1].toAddress();
        uint256 amount = output[2].toUint();
        
        return Output(amount, outputGuard, token);
    }
}



contract WireTransactionWrapper {

    function getOutput(bytes memory transaction, uint16 outputIndex) public pure returns (WireTransaction.Output memory) {
        WireTransaction.Output memory output = WireTransaction.getOutput(transaction, outputIndex);
        return output;
    }

}



contract PaymentTransactionModelMock {

    function decode(bytes memory _transaction) public pure returns (PaymentTransactionModel.Transaction memory) {
        PaymentTransactionModel.Transaction memory transaction = PaymentTransactionModel.decode(_transaction);
        return transaction;
    }

}




contract PaymentOutputModelMock {
    using PaymentOutputModel for PaymentOutputModel.Output;

    using RLP for bytes;

    function decode(bytes memory _output) public pure returns (PaymentOutputModel.Output memory) {
        PaymentOutputModel.Output memory output = PaymentOutputModel.decode(_output.toRLPItem());
        return output;
    }

    function owner(uint256 _amount, address _owner, address _token) public pure returns (address payable) {
        PaymentOutputModel.Output memory output = PaymentOutputModel.Output({
            amount: _amount,
            outputGuard: bytes20(uint160(_owner)),
            token: _token
        });
        return output.owner();
    }
}



// A 'NonCompliantERC20' token is one that uses an old version of the ERC20 standard,
// as described here https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
// Basically, this version does not return anything from `transfer` and `transferFrom`,
// whereas most modern implementions of ERC20 return a boolean to indicate success or failure.
contract NonCompliantERC20 {
    using SafeMath for uint256;

    mapping (address => uint256) private balances;
    mapping (address => mapping (address => uint256)) private allowances;
    uint256 private totalSupply;

    constructor(uint256 _initialAmount) public {
        balances[msg.sender] = _initialAmount;
        totalSupply = _initialAmount;
    }

    function balanceOf(address _account) public view returns (uint256) {
        return balances[_account];
    }

    function transfer(address _to, uint _value) public {
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
    }

    function transferFrom(address _from, address _to, uint _value) public {
        uint256 _allowance = allowances[_from][msg.sender];

        balances[_to] = balances[_to].add(_value);
        balances[_from] = balances[_from].sub(_value);
        allowances[_from][msg.sender] = _allowance.sub(_value);
    }

    function approve(address _spender, uint _value) public {
        allowances[msg.sender][_spender] = _value;
    }

    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {
        return allowances[_owner][_spender];
    }
}



contract SpyErc20VaultForExitGame is Erc20Vault {
    event Erc20WithdrawCalled(
        address target,
        address token,
        uint256 amount
    );

    constructor(PlasmaFramework _framework) public Erc20Vault(_framework) {}

    /** override for test */
    function withdraw(address payable _target, address _token, uint256 _amount) external {
        emit Erc20WithdrawCalled(_target, _token, _amount);
    }
}



contract SpyEthVaultForExitGame is EthVault {
    event EthWithdrawCalled(
        address target,
        uint256 amount
    );

    constructor(PlasmaFramework _framework) public EthVault(_framework) {}

    /** override for test */
    function withdraw(address payable _target, uint256 _amount) external {
        emit EthWithdrawCalled(_target, _amount);
    }
}


interface IStateTransitionVerifier {

    /**
    * @notice Verifies state transition logic.
    */
    function isCorrectStateTransition(
        bytes calldata inFlightTx,
        bytes[] calldata inputTxs,
        uint256[] calldata inputUtxosPos
    )
        external
        view
        returns (bool);
}


contract StateTransitionVerifierAccept is IStateTransitionVerifier {

    function isCorrectStateTransition(
        bytes calldata, /*inFlightTx*/
        bytes[] calldata, /*inputTxs*/
        uint256[] calldata /*inputUtxosPos*/
    )
        external
        view
        returns (bool)
    {
        return true;
    }
}


library PaymentStandardExitRouterArgs {
    /**
     * @notice Wraps arguments for startStandardExit.
     * @param utxoPos Position of the exiting output.
     * @param rlpOutputTx RLP encoded transaction that created the exiting output.
     * @param outputType Specific type of the output.
     * @param outputGuardPreimage Output guard preimage data. (output type excluded)
     * @param outputTxInclusionProof A Merkle proof showing that the transaction was included.
    */
    struct StartStandardExitArgs {
        uint192 utxoPos;
        bytes rlpOutputTx;
        uint256 outputType;
        bytes outputGuardPreimage;
        bytes outputTxInclusionProof;
    }

    /**
     * @notice Input args data for challengeStandardExit.
     * @param exitId Identifier of the standard exit to challenge.
     * @param outputType The output type of the exiting output.
     * @param exitingTx The transaction that is exiting.
     * @param challengeTxType The tx type of the challenge transaction.
     * @param challengeTx RLP encoded transaction that spends the exiting output.
     * @param inputIndex Which input of the challenging tx corresponds to the exiting output.
     * @param witness Witness data that can prove the exiting output is spent.
     * @param spendingConditionOptionalArgs optional extra data for the spending condition.
     * @param outputGuardPreimage (Optional) output guard preimage for the challenge tx to use the output
     * @param challengeTxPos (Optional) tx position of the challenge tx if it is of MVP protocol.
     * @param challengeTxInclusionProof (Optional) if the challenge tx is of MVP protocol provide the inclusion proof of it
     * @param challengeTxConfirmSig (Optional) if the challenge tx is of MVP protocol provide the confirm sig of it
     */
    struct ChallengeStandardExitArgs {
        uint192 exitId;
        uint256 outputType;
        bytes exitingTx;
        uint256 challengeTxType;
        bytes challengeTx;
        uint16 inputIndex;
        bytes witness;
        bytes spendingConditionOptionalArgs;
        bytes outputGuardPreimage;
        uint256 challengeTxPos;
        bytes challengeTxInclusionProof;
        bytes challengeTxConfirmSig;
    }
}


library PaymentExitDataModel {
    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct StandardExit {
        bool exitable;
        uint192 utxoPos;
        bytes32 outputId;
        address token;
        address payable exitTarget;
        uint256 amount;
        uint256 bondSize;
    }

    struct StandardExitMap {
        mapping (uint192 => PaymentExitDataModel.StandardExit) exits;
    }

    struct WithdrawData {
        bytes32 outputId;
        address payable exitTarget;
        address token;
        uint256 amount;
    }

    struct InFlightExit {
        // Canonicity is assumed at start, then can be challenged and is set to `false`.
        // Response to non-canonical challenge can set it back to `true`.
        bool isCanonical;
        bool isFinalized;
        uint64 exitStartTimestamp;

        /**
         * exit map stores piggybacks and finalized exits
         * bit 255 is set only when in-flight exit has finalized
         * right most 0 ~ MAX_INPUT bits is flagged when input is piggybacked
         * right most MAX_INPUT ~ MAX_INPUT + MAX_OUTPUT bits is flagged when output is piggybacked
         */
        uint256 exitMap;
        uint256 position;
        WithdrawData[MAX_INPUT_NUM] inputs;
        WithdrawData[MAX_OUTPUT_NUM] outputs;
        address payable bondOwner;
        uint256 oldestCompetitorPosition;
    }

    struct InFlightExitMap {
        mapping (uint192 => PaymentExitDataModel.InFlightExit) exits;
    }
}


library OutputGuardModel {
    /**
     * @param guard the output guard inside an output
     * @param outputType the output type that the guard holds
     * @param preimage the original data of the output guard aside from output type information
     */
    struct Data {
        bytes20 guard;
        uint256 outputType;
        bytes preimage;
    }
}



interface IOutputGuardHandler {
    /**
    * @notice Checks a given output guard data
    */
    function isValid(OutputGuardModel.Data calldata object) external view returns (bool);

    /**
    * @notice Gets the 'exit target' from the data set
    */
    function getExitTarget(OutputGuardModel.Data calldata object) external view returns (address payable);

    /**
    * @notice Gets the 'confirm signature address' from the data set. Returns address(0) if none.
    */
    function getConfirmSigAddress(OutputGuardModel.Data calldata object) external view returns (address);
}



contract OutputGuardHandlerRegistry is Operated {
    mapping(uint256 => IOutputGuardHandler) public outputGuardHandlers;

    /**
     * @notice Register the output guard handler.
     * @param outputType output type that the parser is registered with.
     * @param handler The output guard handler contract.
     */
    function registerOutputGuardHandler(uint256 outputType, IOutputGuardHandler handler)
        public
        onlyOperator
    {
        require(outputType != 0, "Should not register with output type 0");
        require(address(handler) != address(0), "Should not register an empty address");
        require(address(outputGuardHandlers[outputType]) == address(0), "The output type has already been registered");

        outputGuardHandlers[outputType] = handler;
    }
}


/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two numbers. The result is rounded towards
     * zero.
     */
    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow, so we distribute
        return (a / 2) + (b / 2) + ((a % 2 + b % 2) / 2);
    }
}



library ExitableTimestamp {
    struct Calculator {
        uint256 minExitPeriod;
    }

    function calculate(
        Calculator memory _calculator,
        uint256 _now,
        uint256 _blockTimestamp,
        bool _isDeposit
    )
        internal
        pure
        returns (uint64)
    {
        uint256 minExitableTimestamp = _now + _calculator.minExitPeriod;

        if (_isDeposit) {
            return uint64(minExitableTimestamp);
        }
        return uint64(Math.max(_blockTimestamp + (_calculator.minExitPeriod * 2), minExitableTimestamp));
    }
}



library ExitId {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using Bits for uint192;
    using Bits for uint256;

    function isStandardExit(uint192 _exitId) internal pure returns (bool) {
        return _exitId.getBit(151) == 0;
    }

    /**
     * @notice Given transaction bytes and UTXO position, returns its exit ID.
     * @dev Id from a deposit is computed differently from any other tx.
     * @param _isDeposit Predicate to check whether a block num is a deposit block.
     * @param _txBytes Transaction bytes.
     * @param _utxoPos UTXO position of the exiting output.
     * @return _standardExitId Unique standard exit id.
     *     Anatomy of returned value, most significant bits first:
     *     16 bits - output index
     *     1 bit - in-flight flag (0 for standard exit)
     *     151 bit - hash(tx) or hash(tx|utxo) for deposit
     */
    function getStandardExitId(
        bool _isDeposit,
        bytes memory _txBytes,
        UtxoPosLib.UtxoPos memory _utxoPos
    )
        internal
        pure
        returns (uint192)
    {
        if (_isDeposit) {
            bytes32 hashData = keccak256(abi.encodePacked(_txBytes, _utxoPos.value));
            return _computeStandardExitId(hashData, _utxoPos.outputIndex());
        }

        return _computeStandardExitId(keccak256(_txBytes), _utxoPos.outputIndex());
    }

    /**
    * @notice Given transaction bytes returns in-flight exit ID.
    * @param _txBytes Transaction bytes.
    * @return Unique in-flight exit id.
    */
    function getInFlightExitId(bytes memory _txBytes) internal pure returns (uint192) {
        return uint192((uint256(keccak256(_txBytes)) >> 105).setBit(151));
    }

    /**
    Private
    */
    function _computeStandardExitId(bytes32 _txhash, uint16 _outputIndex)
        private
        pure
        returns (uint192)
    {
        return uint192((uint256(_txhash) >> 105) | (uint256(_outputIndex) << 152));
    }
}


library OutputId {
    /**
     * @notice Computes the output id for deposit tx
     * @dev Deposit tx bytes might not be unique because all inputs are empty.
     *      Two deposit with same output value would result in same tx bytes.
     * @param _txBytes Transaction bytes.
     * @param _outputIndex output index of the output.
     * @param _utxoPosValue (optinal) UTXO position of the deposit output.
     */
    function computeDepositOutputId(bytes memory _txBytes, uint256 _outputIndex, uint256 _utxoPosValue)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(_txBytes, _outputIndex, _utxoPosValue));
    }

    /**
     * @notice Computes the output id for normal (non deposit) tx
     * @param _txBytes Transaction bytes.
     * @param _outputIndex output index of the output.
     */
    function computeNormalOutputId(bytes memory _txBytes, uint256 _outputIndex)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(_txBytes, _outputIndex));
    }
}


library OutputGuard {

    /**
     * @notice Build the output guard from pre-image components (output type and output guard data).
     * @param _outputType type of the output
     * @param _outputGuardPreimage output guard preimage data in bytes
     * @return right most 20 bytes of the hashed data of pre-image with padding 0s in front
     */
    function build(
        uint256 _outputType,
        bytes memory _outputGuardPreimage
    )
        internal
        pure
        returns (bytes20)
    {
        bytes32 hashData = keccak256(abi.encodePacked(_outputType, _outputGuardPreimage));
        return bytes20(uint160(uint256(hashData)));
    }
}


/**
 * @dev Elliptic Curve Digital Signature Algorithm (ECDSA) operations.
 *
 * These functions can be used to verify that a message was signed by the holder
 * of the private keys of a given address.
 */
library ECDSA {
    /**
     * @dev Returns the address that signed a hashed message (`hash`) with
     * `signature`. This address can then be used for verification purposes.
     *
     * The `ecrecover` EVM opcode allows for malleable (non-unique) signatures:
     * this function rejects them by requiring the `s` value to be in the lower
     * half order, and the `v` value to be either 27 or 28.
     *
     * (.note) This call _does not revert_ if the signature is invalid, or
     * if the signer is otherwise unable to be retrieved. In those scenarios,
     * the zero address is returned.
     *
     * (.warning) `hash` _must_ be the result of a hash operation for the
     * verification to be secure: it is possible to craft signatures that
     * recover to arbitrary addresses for non-hashed data. A safe way to ensure
     * this is by receiving a hash of the original message (which may otherwise)
     * be too long), and then calling `toEthSignedMessageHash` on it.
     */
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        // Check the signature length
        if (signature.length != 65) {
            return (address(0));
        }

        // Divide the signature in r, s and v variables
        bytes32 r;
        bytes32 s;
        uint8 v;

        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (281): 0 < s < secp256k1n ÷ 2 + 1, and for v in (282): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        // If the signature is valid (and not malleable), return the signer address
        return ecrecover(hash, v, r, s);
    }

    /**
     * @dev Returns an Ethereum Signed Message, created from a `hash`. This
     * replicates the behavior of the
     * [`eth_sign`](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign)
     * JSON-RPC method.
     *
     * See `recover`.
     */
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        // 32 is the length in bytes of hash,
        // enforced by the type signature above
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}







library TxFinalization {
    using TxPosLib for TxPosLib.TxPos;

    struct Verifier {
        PlasmaFramework framework;
        uint8 protocol;
        bytes txBytes;
        TxPosLib.TxPos txPos;
        bytes inclusionProof;
        bytes confirmSig;
        address confirmSigAddress;
    }

    function moreVpVerifier(
        PlasmaFramework framework,
        bytes memory txBytes,
        TxPosLib.TxPos memory txPos,
        bytes memory inclusionProof
    )
        internal
        pure
        returns (Verifier memory)
    {
        return Verifier({
            framework: framework,
            protocol: Protocol.MORE_VP(),
            txBytes: txBytes,
            txPos: txPos,
            inclusionProof: inclusionProof,
            confirmSig: bytes(""),
            confirmSigAddress: address(0)
        });
    }

    /**
    * @notice Checks a transaction is "standard finalized" or not
    * @dev MVP: need both inclusion proof and confirm signature checked.
    * @dev MoreVp: checks inclusion proof.
    */
    function isStandardFinalized(Verifier memory self) internal view returns (bool) {
        if (self.protocol == Protocol.MVP()) {
            return checkConfirmSig(self) && checkInclusionProof(self);
        } else if (self.protocol == Protocol.MORE_VP()) {
            return checkInclusionProof(self);
        } else {
            // TODO: solhint disabled for now due to bug, https://github.com/protofire/solhint/issues/157
            // solhint-disable-next-line reason-string
            revert("invalid protocol value");
        }
    }

    /**
    * @notice Checks a transaction is "protocol finalized" or not
    * @dev MVP: need to be standard finalzied.
    * @dev MoreVp: it allows in-flight tx, so only checks existence of the transaction.
    */
    function isProtocolFinalized(Verifier memory self) internal view returns (bool) {
        if (self.protocol == Protocol.MVP()) {
            return isStandardFinalized(self);
        } else if (self.protocol == Protocol.MORE_VP()) {
            return self.txBytes.length > 0;
        } else {
            // TODO: solhint disabled for now due to bug, https://github.com/protofire/solhint/issues/157
            // solhint-disable-next-line reason-string
            revert("invalid protocol value");
        }
    }

    function checkInclusionProof(Verifier memory self) private view returns (bool) {
        if (self.inclusionProof.length == 0) {
            return false;
        }

        (bytes32 root,) = self.framework.blocks(self.txPos.blockNum());
        bytes32 leafData = keccak256(self.txBytes);
        return Merkle.checkMembership(
            leafData, self.txPos.txIndex(), root, self.inclusionProof
        );
    }

    /**
    * @dev This checks confirm signature over the block root hash directly.
    * @dev All transactions within the root with same owner would be consider confirmed by this signature.
    */
    function checkConfirmSig(Verifier memory self) private view returns (bool) {
        if (self.confirmSig.length == 0) {
            return false;
        }

        (bytes32 root,) = self.framework.blocks(self.txPos.blockNum());
        return self.confirmSigAddress == ECDSA.recover(root, self.confirmSig);
    }
}

















library PaymentStartStandardExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using TxFinalization for TxFinalization.Verifier;

    struct Controller {
        IExitProcessor exitProcessor;
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
    }

    /**
     * @dev data to be passed around startStandardExit helper functions
     */
    struct StartStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.StartStandardExitArgs args;
        UtxoPosLib.UtxoPos utxoPos;
        PaymentTransactionModel.Transaction outputTx;
        PaymentOutputModel.Output output;
        IOutputGuardHandler outputGuardHandler;
        OutputGuardModel.Data outputGuardData;
        uint192 exitId;
        bool isTxDeposit;
        uint256 txBlockTimeStamp;
        bytes32 outputId;
        TxFinalization.Verifier finalizationVerifier;
    }

    event ExitStarted(
        address indexed owner,
        uint192 exitId
    );

    function buildController(
        IExitProcessor exitProcessor,
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            exitProcessor: exitProcessor,
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            outputGuardHandlerRegistry: outputGuardHandlerRegistry
        });
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
    {
        StartStandardExitData memory data = setupStartStandardExitData(self, args);
        verifyStartStandardExitData(self, data, exitMap);
        saveStandardExitData(data, exitMap);
        enqueueStandardExit(data);

        emit ExitStarted(msg.sender, data.exitId);
    }

    function setupStartStandardExitData(
        Controller memory controller,
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        private
        view
        returns (StartStandardExitData memory)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.utxoPos);
        PaymentTransactionModel.Transaction memory outputTx = PaymentTransactionModel.decode(args.rlpOutputTx);
        PaymentOutputModel.Output memory output = outputTx.outputs[utxoPos.outputIndex()];
        bool isTxDeposit = controller.isDeposit.test(utxoPos.blockNum());
        uint192 exitId = ExitId.getStandardExitId(isTxDeposit, args.rlpOutputTx, utxoPos);
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());

        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: args.outputType,
            preimage: args.outputGuardPreimage
        });

        IOutputGuardHandler outputGuardHandler = controller.outputGuardHandlerRegistry.outputGuardHandlers(args.outputType);

        TxFinalization.Verifier memory finalizationVerifier = TxFinalization.moreVpVerifier(
            controller.framework,
            args.rlpOutputTx,
            utxoPos.txPos(),
            args.outputTxInclusionProof
        );

        bytes32 outputId = isTxDeposit
            ? OutputId.computeDepositOutputId(args.rlpOutputTx, utxoPos.outputIndex(), utxoPos.value)
            : OutputId.computeNormalOutputId(args.rlpOutputTx, utxoPos.outputIndex());

        return StartStandardExitData({
            controller: controller,
            args: args,
            utxoPos: utxoPos,
            outputTx: outputTx,
            output: output,
            outputGuardHandler: outputGuardHandler,
            outputGuardData: outputGuardData,
            exitId: exitId,
            isTxDeposit: isTxDeposit,
            txBlockTimeStamp: blockTimestamp,
            outputId: outputId,
            finalizationVerifier: finalizationVerifier
        });
    }

    function verifyStartStandardExitData(
        Controller memory self,
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
        view
    {
        require(data.output.amount > 0, "Should not exit with amount 0");

        require(address(data.outputGuardHandler) != address(0), "Failed to get the output guard handler for the output type");
        require(data.outputGuardHandler.isValid(data.outputGuardData), "Some of the output guard related information is not valid");
        require(data.outputGuardHandler.getExitTarget(data.outputGuardData) == msg.sender, "Only exit target can start an exit");

        require(data.finalizationVerifier.isStandardFinalized(), "The transaction must be standard finalized");
        require(exitMap.exits[data.exitId].exitable == false, "Exit already started");

        require(self.framework.isOutputSpent(data.outputId) == false, "Output already spent");
    }

    function saveStandardExitData(
        StartStandardExitData memory data,
        PaymentExitDataModel.StandardExitMap storage exitMap
    )
        private
    {
        exitMap.exits[data.exitId] = PaymentExitDataModel.StandardExit({
            exitable: true,
            utxoPos: uint192(data.utxoPos.value),
            outputId: data.outputId,
            token: data.output.token,
            exitTarget: msg.sender,
            amount: data.output.amount,
            bondSize: msg.value
        });
    }

    function enqueueStandardExit(StartStandardExitData memory data) private {
        uint64 exitableAt = data.controller.exitableTimestampCalculator.calculate(
            block.timestamp, data.txBlockTimeStamp, data.isTxDeposit
        );

        data.controller.framework.enqueue(
            data.output.token, exitableAt, data.utxoPos.txPos(),
            data.exitId, data.controller.exitProcessor
        );
    }
}





library PaymentProcessStandardExit {
    struct Controller {
        PlasmaFramework framework;
        EthVault ethVault;
        Erc20Vault erc20Vault;
    }

    event ExitOmitted(
        uint192 indexed exitId
    );

    event ExitFinalized(
        uint192 indexed exitId
    );

    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        uint192 exitId
    )
        public
    {
        PaymentExitDataModel.StandardExit memory exit = exitMap.exits[exitId];

        if (!exit.exitable || self.framework.isOutputSpent(exit.outputId)) {
            emit ExitOmitted(exitId);
            return;
        }

        self.framework.flagOutputSpent(exit.outputId);

        exit.exitTarget.transfer(exit.bondSize);
        if (exit.token == address(0)) {
            self.ethVault.withdraw(exit.exitTarget, exit.amount);
        } else {
            self.erc20Vault.withdraw(exit.exitTarget, exit.token, exit.amount);
        }

        delete exitMap.exits[exitId];

        emit ExitFinalized(exitId);
    }
}


interface ISpendingCondition {

    /**
     * @notice Verifies the spending condition
     * @param inputTx encoded input transaction in bytes
     * @param outputIndex the output index of the input transaction
     * @param inputTxPos the tx position of the input tx. (0 if in-flight)
     * @param spendingTx spending transaction in bytes
     * @param inputIndex the input index of the spending tx that points to the output
     * @param witness the witness data of the spending condition
     * @param optionalArgs some optional data for the spending condition's need (eg. output guard preimage)
     */
    function verify(
        bytes calldata inputTx,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTx,
        uint16 inputIndex,
        bytes calldata witness,
        bytes calldata optionalArgs
    ) external view returns (bool);
}




/**
 * @title SpendingConditionRegistry
 * @notice The registry contracts of spending condition
 * @dev After registering all the essential condition contracts, the owner should renounce its ownership to make sure
 *      no further conditions would be registered for an ExitGame contracts.
 *      https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/ownership/Ownable.sol#L55
 */
contract SpendingConditionRegistry is Ownable {
    mapping(bytes32 => ISpendingCondition) internal _spendingConditions;

    function spendingConditions(uint256 outputType, uint256 spendingTxType) public view returns (ISpendingCondition) {
        bytes32 key = keccak256(abi.encode(outputType, spendingTxType));
        return _spendingConditions[key];
    }

    /**
     * @notice Register the spending condition contract.
     * @param outputType output type of the spending condition.
     * @param spendingTxType spending tx type of the spending condition.
     * @param condition The spending condition contract.
     */
    function registerSpendingCondition(uint256 outputType, uint256 spendingTxType, ISpendingCondition condition)
        public
        onlyOwner
    {
        require(outputType != 0, "Should not register with output type 0");
        require(spendingTxType != 0, "Should not register with spending tx type 0");
        require(address(condition) != address(0), "Should not register an empty address");

        bytes32 key = keccak256(abi.encode(outputType, spendingTxType));
        require(address(_spendingConditions[key]) == address(0), "The (output type, spending tx type) pair has already been registered");

        _spendingConditions[key] = condition;
    }
}


















library PaymentChallengeStandardExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using TxFinalization for TxFinalization.Verifier;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        SpendingConditionRegistry spendingConditionRegistry;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
    }

    event ExitChallenged(
        uint256 indexed utxoPos
    );

    /**
     * @dev data to be passed around helper functions
     */
    struct ChallengeStandardExitData {
        Controller controller;
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args;
        PaymentExitDataModel.StandardExit exitData;
    }

    function buildController(
        PlasmaFramework framework,
        SpendingConditionRegistry spendingConditionRegistry,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            spendingConditionRegistry: spendingConditionRegistry,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry
        });
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.StandardExitMap storage exitMap,
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args
    )
        public
    {
        ChallengeStandardExitData memory data = ChallengeStandardExitData({
            controller: self,
            args: args,
            exitData: exitMap.exits[args.exitId]
        });
        verifyChallengeExitExists(data);
        verifyChallengeTxProtocolFinalized(data);
        verifySpendingCondition(data);

        delete exitMap.exits[args.exitId];
        msg.sender.transfer(data.exitData.bondSize);

        emit ExitChallenged(data.exitData.utxoPos);
    }

    function verifyChallengeExitExists(ChallengeStandardExitData memory data) private pure {
        require(data.exitData.exitable == true, "Such exit does not exist");
    }

    function verifyChallengeTxProtocolFinalized(ChallengeStandardExitData memory data) private view {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        PaymentOutputModel.Output memory output = PaymentTransactionModel
            .decode(data.args.exitingTx)
            .outputs[utxoPos.outputIndex()];

        IOutputGuardHandler outputGuardHandler = data.controller
                                                .outputGuardHandlerRegistry
                                                .outputGuardHandlers(data.args.outputType);

        require(address(outputGuardHandler) != address(0), "Failed to get the outputGuardHandler of the output type");

        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: output.outputGuard,
            outputType: data.args.outputType,
            preimage: data.args.outputGuardPreimage
        });
        require(outputGuardHandler.isValid(outputGuardData),
                "Output guard information is invalid");

        uint8 protocol = data.controller.framework.protocols(data.args.challengeTxType);
        TxFinalization.Verifier memory verifier = TxFinalization.Verifier({
            framework: data.controller.framework,
            protocol: protocol,
            txBytes: data.args.challengeTx,
            txPos: TxPosLib.TxPos(data.args.challengeTxPos),
            inclusionProof: data.args.challengeTxInclusionProof,
            confirmSig: data.args.challengeTxConfirmSig,
            confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
        });
        require(verifier.isProtocolFinalized(), "Challenge transaction is not protocol finalized");
    }

    function verifySpendingCondition(ChallengeStandardExitData memory data) private view {
        PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args = data.args;

        // correctness of output type is checked in the outputGuardHandler.isValid(...)
        // inside verifyChallengeTxProtocolFinalized(...)
        ISpendingCondition condition = data.controller.spendingConditionRegistry.spendingConditions(
            args.outputType, args.challengeTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(data.exitData.utxoPos);
        bytes32 outputId = data.controller.isDeposit.test(utxoPos.blockNum())
                ? OutputId.computeDepositOutputId(args.exitingTx, utxoPos.outputIndex(), utxoPos.value)
                : OutputId.computeNormalOutputId(args.exitingTx, utxoPos.outputIndex());
        require(outputId == data.exitData.outputId, "The exiting tx is not valid, thus causing outputId mismatch");

        bool isSpentByChallengeTx = condition.verify(
            args.exitingTx,
            utxoPos.outputIndex(),
            utxoPos.txPos().value,
            args.challengeTx,
            args.inputIndex,
            args.witness,
            args.spendingConditionOptionalArgs
        );
        require(isSpentByChallengeTx, "Spending condition failed");
    }
}
















contract PaymentStandardExitRouter is
    IExitProcessor,
    Operated,
    OnlyWithValue
{
    using PaymentStartStandardExit for PaymentStartStandardExit.Controller;
    using PaymentChallengeStandardExit for PaymentChallengeStandardExit.Controller;
    using PaymentProcessStandardExit for PaymentProcessStandardExit.Controller;
    using BondSize for BondSize.Params;

    // Initial bond size = 70000 (gas cost of challenge) * 20 gwei (current fast gas price) * 10 (safety margin)
    uint128 public constant INITIAL_BOND_SIZE = 14000000000000000 wei;
    uint16 public constant BOND_LOWER_BOUND_DIVISOR = 2;
    uint16 public constant BOND_UPPER_BOUND_MULTIPLIER = 2;

    PaymentExitDataModel.StandardExitMap internal standardExitMap;
    PaymentStartStandardExit.Controller internal startStandardExitController;
    PaymentProcessStandardExit.Controller internal processStandardExitController;
    PaymentChallengeStandardExit.Controller internal challengeStandardExitController;
    BondSize.Params internal startStandardExitBond;

    event StandardExitBondUpdated(uint128 bondSize);

    constructor(
        PlasmaFramework framework,
        EthVault ethVault,
        Erc20Vault erc20Vault,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        SpendingConditionRegistry spendingConditionRegistry
    )
        public
    {
        startStandardExitController = PaymentStartStandardExit.buildController(
            this, framework, outputGuardHandlerRegistry
        );

        challengeStandardExitController = PaymentChallengeStandardExit.buildController(
            framework, spendingConditionRegistry, outputGuardHandlerRegistry
        );

        processStandardExitController = PaymentProcessStandardExit.Controller(
            framework, ethVault, erc20Vault
        );

        startStandardExitBond = BondSize.buildParams(INITIAL_BOND_SIZE, BOND_LOWER_BOUND_DIVISOR, BOND_UPPER_BOUND_MULTIPLIER);
    }

    function standardExits(uint192 _exitId) public view returns (PaymentExitDataModel.StandardExit memory) {
        return standardExitMap.exits[_exitId];
    }

    /**
     * @notice Gets the standard exit bond size.
     */
    function startStandardExitBondSize() public view returns (uint128) {
        return startStandardExitBond.bondSize();
    }

    /**
     * @notice Updates the standard exit bond size. Will take 2 days to come into effect.
     * @param newBondSize The new bond size.
     */
    function updateStartStandardExitBondSize(uint128 newBondSize) public onlyOperator {
        startStandardExitBond.updateBondSize(newBondSize);
        emit StandardExitBondUpdated(newBondSize);
    }

    /**
     * @notice Starts a standard exit of a given output. Uses output-age priority.
     */
    function startStandardExit(
        PaymentStandardExitRouterArgs.StartStandardExitArgs memory args
    )
        public
        payable
        onlyWithValue(startStandardExitBondSize())
    {
        startStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Challenge a standard exit by showing the exiting output was spent.
     */
    function challengeStandardExit(PaymentStandardExitRouterArgs.ChallengeStandardExitArgs memory args)
        public
        payable
    {
        challengeStandardExitController.run(standardExitMap, args);
    }

    /**
     * @notice Process standard exit.
     * @dev This function is designed to be called in the main processExit function. Thus using internal.
     * @param _exitId The standard exit id.
     */
    function processStandardExit(uint192 _exitId) internal {
        processStandardExitController.run(standardExitMap, _exitId);
    }
}




contract PaymentStandardExitRouterMock is PaymentStandardExitRouter {
    PlasmaFramework private framework;

    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardHandlerRegistry _outputGuardHandlerRegistry,
        SpendingConditionRegistry _spendingConditionRegistry
    )
        public
        PaymentStandardExitRouter(
            _framework,
            _ethVault,
            _erc20Vault,
            _outputGuardHandlerRegistry,
            _spendingConditionRegistry
        )
    {
        framework = _framework;
    }

    /** override and calls processStandardExit for test */
    function processExit(uint192 _exitId) external {
        PaymentStandardExitRouter.processStandardExit(_exitId);
    }

    /** helper functions for testing */
    function setExit(uint192 _exitId, PaymentExitDataModel.StandardExit memory _exitData) public {
        PaymentStandardExitRouter.standardExitMap.exits[_exitId] = _exitData;
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        framework.flagOutputSpent(_outputId);
    }

    function depositFundForTest() public payable {}
}


library PaymentInFlightExitRouterArgs {
    /**
    * @notice Wraps arguments for startInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputTxs Transactions that created the inputs to the in-flight transaction. In the same order as in-flight transaction inputs.
    * @param inputTxTypes Transaction type of the input transactions.
    * @param inputUtxosPos Utxos that represent in-flight transaction inputs. In the same order as input transactions.
    * @param inputUtxosTypes Output types of in flight transaction inputs. In the same order as input transactions.
    * @param outputGuardPreimagesForInputs Output guard pre-images for in-flight transaction inputs.
    * @param inputTxsInclusionProofs Merkle proofs that show the input-creating transactions are valid. In the same order as input transactions.
    * @param inputTxsConfirmSigs Confirm signatures for the input txs. Should be empty bytes if the input tx is MoreVP.
    * @param inFlightTxWitnesses Witnesses for in-flight transaction. In the same order as input transactions.
    */
    struct StartExitArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputTxTypes;
        uint256[] inputUtxosPos;
        uint256[] inputUtxosTypes;
        bytes[] outputGuardPreimagesForInputs;
        bytes[] inputTxsInclusionProofs;
        bytes[] inputTxsConfirmSigs;
        bytes[] inFlightTxWitnesses;
    }

    /**
    * @notice Wraps arguments for piggybackInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param inputIndex Index of the input/output to piggyback on.
    */
    struct PiggybackInFlightExitOnInputArgs {
        bytes inFlightTx;
        uint16 inputIndex;
    }

    /**
    * @notice Wraps arguments for piggybackInFlightExit.
    * @param inFlightTx RLP encoded in-flight transaction.
    * @param outputIndex Index of the output to piggyback on.
    * @param outputType The output type of the piggyback output.
    * @param outputGuardPreimage The original data (pre-image) for the outputguard.
    */
    struct PiggybackInFlightExitOnOutputArgs {
        bytes inFlightTx;
        uint16 outputIndex;
        uint256 outputType;
        bytes outputGuardPreimage;
    }

    /*
     * @notice Wraps arguments for challenge in-flight exit not canonical.
     * @param inFlightTx RLP encoded in-flight transaction.
     * @param inFlightTxInputIndex Index of shared input in transaction in flight.
     * @param competingTx RLP encoded competing transaction.
     * @param competingTxInputIndex Index of shared input in competing transaction.
     * @param competingTxInputOutputType Output type of shared input.
     * @param competingTxPos (optional) Position of competing transaction in chain if included.
     * @param competingTxInclusionProof (optional) Merkle proofs that show the competing transaction was contained in chain.
     * @param competingTxWitness Witness for competing transaction.
     */
    struct ChallengeCanonicityArgs {
        bytes inFlightTx;
        uint8 inFlightTxInputIndex;
        bytes competingTx;
        uint8 competingTxInputIndex;
        uint256 competingTxInputOutputType;
        uint256 competingTxPos;
        bytes competingTxInclusionProof;
        bytes competingTxWitness;
    }
}




library PaymentInFlightExitModelUtils {
    using Bits for uint256;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    function isInputPiggybacked(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        return ife.exitMap.bitSet(uint8(index));
    }

    function isOutputPiggybacked(ExitModel.InFlightExit memory ife, uint16 index)
        internal
        pure
        returns (bool)
    {
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        return ife.exitMap.bitSet(indexInExitMap);
    }

    function setInputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        ife.exitMap = ife.exitMap.setBit(uint8(index));
    }

    function setOutputPiggybacked(ExitModel.InFlightExit storage ife, uint16 index)
        internal
    {
        uint8 indexInExitMap = uint8(index + MAX_INPUT_NUM);
        ife.exitMap = ife.exitMap.setBit(indexInExitMap);
    }

    function isInFirstPhase(ExitModel.InFlightExit memory ife, uint256 minExitPeriod)
        internal
        view
        returns (bool)
    {
        uint256 periodTime = minExitPeriod / 2;
        return ((block.timestamp - ife.exitStartTimestamp) / periodTime) < 1;
    }

    function isFirstPiggybackOfTheToken(ExitModel.InFlightExit memory ife, address token)
        internal
        pure
        returns (bool)
    {
        bool isPiggybackInput = true;
        for (uint i = 0; i < MAX_INPUT_NUM; i++) {
            if (isInputPiggybacked(ife, uint16(i)) && ife.inputs[i].token == token) {
                return false;
            }
        }

        isPiggybackInput = false;
        for (uint i = 0; i < MAX_OUTPUT_NUM; i++) {
            if (isOutputPiggybacked(ife, uint16(i)) && ife.outputs[i].token == token) {
                return false;
            }
        }

        return true;
    }
}


interface IPaymentSpendingCondition {
    /**
     * @notice Checks output spending condition.
     * @param _outputGuard OutputGuard of the output.
     * @param _utxoPos (optional) serves as the identifier of output. Only one of utxoPos or outputId must be set.
     * @param _outputId (optional) serves as the identifier of output. Only one of utxoPos or outputId must be set.
     * @param _spendingTx The transaction that spends the output.
     * @param _inputIndex The input index of the spending transaction that points to the output.
     * @param _witness Witness data proving the output can be spent.
     */
    function verify(
        bytes32 _outputGuard,
        uint256 _utxoPos,
        bytes32 _outputId,
        bytes calldata _spendingTx,
        uint8 _inputIndex,
        bytes calldata _witness
    ) external view returns (bool);
}




contract PaymentSpendingConditionRegistry is Ownable {
    mapping(bytes32 => IPaymentSpendingCondition) private _spendingConditions;

    function spendingConditions(uint256 _outputType, uint256 _spendingTxType)
        public
        view
        returns (IPaymentSpendingCondition)
    {
        bytes32 key = keccak256(abi.encodePacked(_outputType, _spendingTxType));
        return _spendingConditions[key];
    }

    /**
     * @notice Register the spending condition.
     * @dev output type with 0 is allowed but spending tx type should not be 0 (by design of tx type)
     * @param _outputType output type that the parser is registered with.
     * @param _spendingTxType output type that the parser is registered with.
     * @param _address Address of the spending condition contract.
     */
    function registerSpendingCondition(uint256 _outputType, uint256 _spendingTxType, address _address)
        public
        onlyOwner
    {
        require(_outputType != 0, "Output Type must not be 0");
        require(_spendingTxType != 0, "Transaction Type must not be 0");
        require(_address != address(0), "Should not register an empty address");

        bytes32 key = keccak256(abi.encodePacked(_outputType, _spendingTxType));
        require(address(_spendingConditions[key]) == address(0),
                "This (output type, spending tx type) pair has already been registered");

        _spendingConditions[key] = IPaymentSpendingCondition(_address);
    }
}























library PaymentStartInFlightExit {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using IsDeposit for IsDeposit.Predicate;
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using TxFinalization for TxFinalization.Verifier;

    uint256 constant public MAX_INPUT_NUM = 4;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitTimestampCalculator;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        PaymentSpendingConditionRegistry spendingConditionRegistry;
        IStateTransitionVerifier transitionVerifier;
        uint256 supportedTxType;
    }

    event InFlightExitStarted(
        address indexed initiator,
        bytes32 txHash
    );

     /**
     * @dev data to be passed around start in-flight exit helper functions
     * @param exitId ID of the exit.
     * @param inFlightTxRaw In-flight transaction as bytes.
     * @param inFlightTx Decoded in-flight transaction.
     * @param inFlightTxHash Hash of in-flight transaction.
     * @param inputTxs Input transactions as bytes.
     * @param inputUtxosPos Postions of input utxos.
     * @param inputUtxosPos Postions of input utxos coded as integers.
     * @param inputUtxosTypes Types of outputs that make in-flight transaction inputs.
     * @param outputGuardPreimagesForInputs Output guard pre-images for in-flight transaction inputs.
     * @param inputTxsInclusionProofs Merkle proofs for input transactions.
     * @param inputTxsConfirmSigs Confirm signatures for the input txs.
     * @param inFlightTxWitnesses Witnesses for in-flight transactions.
     * @param outputIds Output ids for input transactions.
     */
    struct StartExitData {
        Controller controller;
        uint192 exitId;
        bytes inFlightTxRaw;
        PaymentTransactionModel.Transaction inFlightTx;
        bytes32 inFlightTxHash;
        bytes[] inputTxs;
        UtxoPosLib.UtxoPos[] inputUtxosPos;
        uint256[] inputUtxosPosRaw;
        uint256[] inputUtxosTypes;
        uint256[] inputTxTypes;
        bytes[] outputGuardPreimagesForInputs;
        bytes[] inputTxsInclusionProofs;
        bytes[] inputTxsConfirmSigs;
        bytes[] inFlightTxWitnesses;
        bytes32[] outputIds;
    }

    function buildController(
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier transitionVerifier,
        uint256 supportedTxType
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            spendingConditionRegistry: spendingConditionRegistry,
            transitionVerifier: transitionVerifier,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            supportedTxType: supportedTxType
        });
    }

    function run(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.StartExitArgs memory args
    )
        public
    {
        StartExitData memory startExitData = createStartExitData(self, args);
        verifyStart(startExitData, inFlightExitMap);
        startExit(startExitData, inFlightExitMap);
        emit InFlightExitStarted(msg.sender, startExitData.inFlightTxHash);
    }

    function createStartExitData(
        Controller memory controller,
        PaymentInFlightExitRouterArgs.StartExitArgs memory args
    )
        private
        pure
        returns (StartExitData memory)
    {
        StartExitData memory exitData;
        exitData.controller = controller;
        exitData.exitId = ExitId.getInFlightExitId(args.inFlightTx);
        exitData.inFlightTxRaw = args.inFlightTx;
        exitData.inFlightTx = PaymentTransactionModel.decode(args.inFlightTx);
        exitData.inFlightTxHash = keccak256(args.inFlightTx);
        exitData.inputTxs = args.inputTxs;
        exitData.inputTxTypes = args.inputTxTypes;
        exitData.inputUtxosPos = decodeInputTxsPositions(args.inputUtxosPos);
        exitData.inputUtxosPosRaw = args.inputUtxosPos;
        exitData.inputUtxosTypes = args.inputUtxosTypes;
        exitData.inputTxsInclusionProofs = args.inputTxsInclusionProofs;
        exitData.inputTxsConfirmSigs = args.inputTxsConfirmSigs;
        exitData.outputGuardPreimagesForInputs = args.outputGuardPreimagesForInputs;
        exitData.inFlightTxWitnesses = args.inFlightTxWitnesses;
        exitData.outputIds = getOutputIds(controller, exitData.inputTxs, exitData.inputUtxosPos);
        return exitData;
    }

    function decodeInputTxsPositions(uint256[] memory inputUtxosPos) private pure returns (UtxoPosLib.UtxoPos[] memory) {
        require(inputUtxosPos.length <= MAX_INPUT_NUM, "Too many transactions provided");

        UtxoPosLib.UtxoPos[] memory utxosPos = new UtxoPosLib.UtxoPos[](inputUtxosPos.length);
        for (uint i = 0; i < inputUtxosPos.length; i++) {
            utxosPos[i] = UtxoPosLib.UtxoPos(inputUtxosPos[i]);
        }
        return utxosPos;
    }

    function getOutputIds(Controller memory controller, bytes[] memory inputTxs, UtxoPosLib.UtxoPos[] memory utxoPos)
        private
        pure
        returns (bytes32[] memory)
    {
        require(inputTxs.length == utxoPos.length, "Number of input transactions does not match number of provided input utxos positions");
        bytes32[] memory outputIds = new bytes32[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            bool isDepositTx = controller.isDeposit.test(utxoPos[i].blockNum());
            outputIds[i] = isDepositTx
                ? OutputId.computeDepositOutputId(inputTxs[i], utxoPos[i].outputIndex(), utxoPos[i].value)
                : OutputId.computeNormalOutputId(inputTxs[i], utxoPos[i].outputIndex());
        }
        return outputIds;
    }

    function verifyStart(
        StartExitData memory exitData,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
        view
    {
        verifyExitNotStarted(exitData.exitId, inFlightExitMap);
        verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(exitData);
        verifyNoInputSpentMoreThanOnce(exitData.inFlightTx);
        verifyInputTransactionIsStandardFinalized(exitData);
        verifyInputsSpent(exitData);
        require(
            exitData.controller.transitionVerifier.isCorrectStateTransition(exitData.inFlightTxRaw, exitData.inputTxs, exitData.inputUtxosPosRaw),
            "Invalid state transition"
        );
    }

    function verifyExitNotStarted(
        uint192 exitId,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
        view
    {
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];
        require(exit.exitStartTimestamp == 0, "There is an active in-flight exit from this transaction");
        require(!exit.isFinalized, "This in-flight exit has already been finalized");
    }

    function verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(StartExitData memory exitData) private pure {
        require(
            exitData.inputTxs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxTypes.length == exitData.inFlightTx.inputs.length,
            "Number of input tx types does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputUtxosPos.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions positions does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputUtxosTypes.length == exitData.inFlightTx.inputs.length,
            "Number of input utxo types does not match number of in-flight transaction inputs"
        );
        require(
            exitData.outputGuardPreimagesForInputs.length == exitData.inFlightTx.inputs.length,
            "Number of output guard preimages for inputs does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxsInclusionProofs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions inclusion proofs does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inFlightTxWitnesses.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions witnesses does not match number of in-flight transaction inputs"
        );
        require(
            exitData.inputTxsConfirmSigs.length == exitData.inFlightTx.inputs.length,
            "Number of input transactions confirm sigs does not match number of in-flight transaction inputs"
        );
    }

    function verifyNoInputSpentMoreThanOnce(PaymentTransactionModel.Transaction memory inFlightTx) private pure {
        if (inFlightTx.inputs.length > 1) {
            for (uint i = 0; i < inFlightTx.inputs.length; i++) {
                for (uint j = i + 1; j < inFlightTx.inputs.length; j++) {
                    require(inFlightTx.inputs[i] != inFlightTx.inputs[j], "In-flight transaction must have unique inputs");
                }
            }
        }
    }

    function verifyInputTransactionIsStandardFinalized(StartExitData memory exitData) private view {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            WireTransaction.Output memory output = WireTransaction.getOutput(exitData.inputTxs[i], outputIndex);
            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
                guard: output.outputGuard,
                outputType: exitData.inputUtxosTypes[i],
                preimage: exitData.outputGuardPreimagesForInputs[i]
            });
            IOutputGuardHandler outputGuardHandler = exitData.controller
                                                    .outputGuardHandlerRegistry
                                                    .outputGuardHandlers(exitData.inputUtxosTypes[i]);

            require(address(outputGuardHandler) != address(0), "Failed to get the outputGuardHandler of the output type");

            require(outputGuardHandler.isValid(outputGuardData),
                    "Output guard information is invalid for the input tx");

            uint8 protocol = exitData.controller.framework.protocols(exitData.inputTxTypes[i]);

            TxFinalization.Verifier memory verifier = TxFinalization.Verifier({
                framework: exitData.controller.framework,
                protocol: protocol,
                txBytes: exitData.inputTxs[i],
                txPos: exitData.inputUtxosPos[i].txPos(),
                inclusionProof: exitData.inputTxsInclusionProofs[i],
                confirmSig: exitData.inputTxsConfirmSigs[i],
                confirmSigAddress: outputGuardHandler.getConfirmSigAddress(outputGuardData)
            });
            require(verifier.isStandardFinalized(), "Input transaction is not standard finalized");
        }
    }

    function verifyInputsSpent(StartExitData memory exitData) private view {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            WireTransaction.Output memory output = WireTransaction.getOutput(exitData.inputTxs[i], outputIndex);

            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
                guard: output.outputGuard,
                outputType: exitData.inputUtxosTypes[i],
                preimage: exitData.outputGuardPreimagesForInputs[i]
            });
            IOutputGuardHandler outputGuardHandler = exitData.controller
                                                    .outputGuardHandlerRegistry
                                                    .outputGuardHandlers(exitData.inputUtxosTypes[i]);
            require(address(outputGuardHandler) != address(0), "Failed to get the outputGuardHandler of the output type");
            require(outputGuardHandler.isValid(outputGuardData),
                    "Output guard information is invalid for the input tx");

            //FIXME: consider moving spending conditions to PlasmaFramework
            IPaymentSpendingCondition condition = exitData.controller.spendingConditionRegistry.spendingConditions(
                exitData.inputUtxosTypes[i], exitData.controller.supportedTxType
            );

            require(address(condition) != address(0), "Spending condition contract not found");

            bool isSpentByInFlightTx = condition.verify(
                output.outputGuard,
                exitData.inputUtxosPos[i].value,
                exitData.outputIds[i],
                exitData.inFlightTxRaw,
                uint8(i),
                exitData.inFlightTxWitnesses[i]
            );
            require(isSpentByInFlightTx, "Spending condition failed");
        }
    }

    function startExit(
        StartExitData memory startExitData,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap
    )
        private
    {
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[startExitData.exitId];
        ife.isCanonical = true;
        ife.bondOwner = msg.sender;
        ife.position = getYoungestInputUtxoPosition(startExitData.inputUtxosPos);
        ife.exitStartTimestamp = uint64(block.timestamp);
        setInFlightExitInputs(ife, startExitData);
        setInFlightExitOutputs(ife, startExitData);
    }

    function getYoungestInputUtxoPosition(UtxoPosLib.UtxoPos[] memory inputUtxosPos) private pure returns (uint256) {
        uint256 youngest = inputUtxosPos[0].value;
        for (uint i = 1; i < inputUtxosPos.length; i++) {
            if (inputUtxosPos[i].value > youngest) {
                youngest = inputUtxosPos[i].value;
            }
        }
        return youngest;
    }

    function setInFlightExitInputs(
        PaymentExitDataModel.InFlightExit storage ife,
        StartExitData memory exitData
    )
        private
    {
        for (uint i = 0; i < exitData.inputTxs.length; i++) {
            uint16 outputIndex = exitData.inputUtxosPos[i].outputIndex();
            WireTransaction.Output memory output = WireTransaction.getOutput(exitData.inputTxs[i], outputIndex);

            OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data(
                output.outputGuard,
                exitData.inputUtxosTypes[i],
                exitData.outputGuardPreimagesForInputs[i]
            );
            IOutputGuardHandler handler = exitData.controller.outputGuardHandlerRegistry.outputGuardHandlers(exitData.inputUtxosTypes[i]);
            require(address(handler) != address(0), "Output guard handler not registered");
            address payable exitTarget = handler.getExitTarget(outputGuardData);

            ife.inputs[i].outputId = exitData.outputIds[i];
            ife.inputs[i].exitTarget = exitTarget;
            ife.inputs[i].token = output.token;
            ife.inputs[i].amount = output.amount;
        }
    }

    function setInFlightExitOutputs(
        PaymentExitDataModel.InFlightExit storage ife,
        StartExitData memory exitData
    )
        private
    {
        for (uint i = 0; i < exitData.inFlightTx.outputs.length; i++) {
            // deposit transaction can't be in-flight exited
            bytes32 outputId = OutputId.computeNormalOutputId(exitData.inFlightTxRaw, i);
            PaymentOutputModel.Output memory output = exitData.inFlightTx.outputs[i];

            ife.outputs[i].outputId = outputId;
            // exit target is not set as output guard preimage many not be available for caller
            ife.outputs[i].token = output.token;
            ife.outputs[i].amount = output.amount;
        }
    }
}

















library PaymentPiggybackInFlightExit {
    using UtxoPosLib for UtxoPosLib.UtxoPos;
    using IsDeposit for IsDeposit.Predicate;
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    using PaymentInFlightExitModelUtils for PaymentExitDataModel.InFlightExit;
    using PaymentOutputModel for PaymentOutputModel.Output;

    uint8 constant public MAX_INPUT_NUM = 4;
    uint8 constant public MAX_OUTPUT_NUM = 4;

    struct Controller {
        PlasmaFramework framework;
        IsDeposit.Predicate isDeposit;
        ExitableTimestamp.Calculator exitableTimestampCalculator;
        IExitProcessor exitProcessor;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        uint256 minExitPeriod;
    }

    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 inputIndex
    );

    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 outputIndex
    );

    function buildController(
        PlasmaFramework framework,
        IExitProcessor exitProcessor,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry
    )
        public
        view
        returns (Controller memory)
    {
        return Controller({
            framework: framework,
            isDeposit: IsDeposit.Predicate(framework.CHILD_BLOCK_INTERVAL()),
            exitableTimestampCalculator: ExitableTimestamp.Calculator(framework.minExitPeriod()),
            exitProcessor: exitProcessor,
            outputGuardHandlerRegistry: outputGuardHandlerRegistry,
            minExitPeriod: framework.minExitPeriod()
        });
    }

    /**
     * @notice The main controller logic for 'piggybackInFlightExitOnInput'
     */
    function piggybackInput(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];

        require(exit.exitStartTimestamp != 0, "No in-flight exit to piggyback on");
        require(exit.isInFirstPhase(self.minExitPeriod), "Can only piggyback in first phase of exit period");

        require(args.inputIndex < MAX_INPUT_NUM, "Index exceed max size of the input");
        require(!exit.isInputPiggybacked(args.inputIndex), "The indexed input has been piggybacked already");

        PaymentExitDataModel.WithdrawData storage withdrawData = exit.inputs[args.inputIndex];

        // In startInFlightExit, exitTarget for inputs would be saved as those are the neccesarry data to create the transaction
        require(withdrawData.exitTarget == msg.sender, "Can be called by the exit target only");

        if (exit.isFirstPiggybackOfTheToken(withdrawData.token)) {
            enqueue(self, withdrawData.token, UtxoPosLib.UtxoPos(exit.position), exitId);
        }

        exit.setInputPiggybacked(args.inputIndex);

        emit InFlightExitInputPiggybacked(msg.sender, keccak256(args.inFlightTx), args.inputIndex);
    }

    /**
     * @notice The main controller logic for 'piggybackInFlightExitOnOutput'
     */
    function piggybackOutput(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage exit = inFlightExitMap.exits[exitId];

        require(exit.exitStartTimestamp != 0, "No in-flight exit to piggyback on");
        require(exit.isInFirstPhase(self.minExitPeriod), "Can only piggyback in first phase of exit period");

        require(args.outputIndex < MAX_OUTPUT_NUM, "Index exceed max size of the output");
        require(!exit.isOutputPiggybacked(args.outputIndex), "The indexed output has been piggybacked already");

        PaymentExitDataModel.WithdrawData storage withdrawData = exit.outputs[args.outputIndex];

        // Though for inputs, exit target is set during start inFlight exit.
        // For outputs since the output preimage data is hold by the output owners themselves, need to get those on piggyback.
        bytes20 outputGuard = getOutputGuardFromPaymentTxBytes(args.inFlightTx, args.outputIndex);
        address payable exitTarget = getExitTargetOfOutput(self, outputGuard, args.outputType, args.outputGuardPreimage);
        require(exitTarget == msg.sender, "Can be called by the exit target only");

        if (exit.isFirstPiggybackOfTheToken(withdrawData.token)) {
            enqueue(self, withdrawData.token, UtxoPosLib.UtxoPos(exit.position), exitId);
        }

        // Exit Target for outputs is set in piggyback instead of start in-flight exit
        withdrawData.exitTarget = exitTarget;

        exit.setOutputPiggybacked(args.outputIndex);

        emit InFlightExitOutputPiggybacked(msg.sender, keccak256(args.inFlightTx), args.outputIndex);
    }

    function enqueue(
        Controller memory controller,
        address token,
        UtxoPosLib.UtxoPos memory utxoPos,
        uint192 exitId
    )
        private
    {
        (, uint256 blockTimestamp) = controller.framework.blocks(utxoPos.blockNum());

        // TODO: change the ExitableTimestamp interface as 'isDeposit' should be used only in SE, in IFE it doesn't matter
        // Could update the interface to be cleaner and not forcing a "false" here.
        // https://github.com/omisego/plasma-contracts/issues/216
        bool isPositionDeposit = false;
        uint64 exitableAt = controller.exitableTimestampCalculator.calculate(now, blockTimestamp, isPositionDeposit);

        controller.framework.enqueue(token, exitableAt, utxoPos.txPos(), exitId, controller.exitProcessor);
    }

    function getOutputGuardFromPaymentTxBytes(bytes memory txBytes, uint16 outputIndex)
        private
        pure
        returns (bytes20)
    {
        PaymentOutputModel.Output memory output = PaymentTransactionModel.decode(txBytes).outputs[outputIndex];
        return output.outputGuard;
    }

    function getExitTargetOfOutput(
        Controller memory controller,
        bytes20 outputGuard,
        uint256 outputType,
        bytes memory outputGuardPreimage
    )
        private
        view
        returns (address payable)
    {
        OutputGuardModel.Data memory outputGuardData = OutputGuardModel.Data({
            guard: outputGuard,
            outputType: outputType,
            preimage: outputGuardPreimage
        });
        IOutputGuardHandler handler = controller.outputGuardHandlerRegistry
                                                .outputGuardHandlers(outputType);

        require(address(handler) != address(0),
            "Does not have outputGuardHandler registered for the output type");

        require(handler.isValid(outputGuardData),
                "Some of the output guard related information is not valid");
        return handler.getExitTarget(outputGuardData);
    }
}











library PaymentChallengeIFENotCanonical {
    using UtxoPosLib for UtxoPosLib.UtxoPos;

    struct Controller {
        PlasmaFramework framework;
        PaymentSpendingConditionRegistry spendingConditionRegistry;
        uint256 supportedTxType;
    }

    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    event InFlightExitChallengeResponded(
        address challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );

    function challenge(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(args.inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-fligh exit doesn't exists");

        verifyFirstPhaseNotOver(ife, self.framework.minExitPeriod());

        require(
            keccak256(args.inFlightTx) != keccak256(args.competingTx),
            "The competitor transaction is the same as transaction in-flight"
        );

        IPaymentSpendingCondition condition = self.spendingConditionRegistry.spendingConditions(
            args.competingTxInputOutputType, self.supportedTxType
        );
        require(address(condition) != address(0), "Spending condition contract not found");

        // FIXME: move to the finalized interface as https://github.com/omisego/plasma-contracts/issues/214
        // Also, the tests should verify the args correctness
        bool isSpentByInFlightTx = condition.verify(
            bytes32(""), // tmp solution, we don't need outputGuard anymore for the interface of :point-up: GH-214
            uint256(0), // should not be used
            ife.inputs[args.inFlightTxInputIndex].outputId,
            args.competingTx,
            args.competingTxInputIndex,
            args.competingTxWitness
        );
        require(isSpentByInFlightTx, "Competing input spending condition is not met");

        // Determine the position of the competing transaction
        uint256 competitorPosition = ~uint256(0);
        if (args.competingTxPos != 0) {
            UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(args.competingTxPos);
            (bytes32 root, ) = self.framework.blocks(utxoPos.blockNum());
            competitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
                args.competingTx, utxoPos, root, args.competingTxInclusionProof
            );
        }

        require(
            ife.oldestCompetitorPosition == 0 || ife.oldestCompetitorPosition > competitorPosition,
            "Competing transaction is not older than already known competitor"
        );

        ife.oldestCompetitorPosition = competitorPosition;
        ife.bondOwner = msg.sender;

        // Set a flag so that only the inputs are exitable, unless a response is received.
        ife.isCanonical = false;

        emit InFlightExitChallenged(msg.sender, keccak256(args.inFlightTx), competitorPosition);
    }

    function respond(
        Controller memory self,
        PaymentExitDataModel.InFlightExitMap storage inFlightExitMap,
        bytes memory inFlightTx,
        uint256 inFlightTxPos,
        bytes memory inFlightTxInclusionProof
    )
        public
    {
        uint192 exitId = ExitId.getInFlightExitId(inFlightTx);
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        require(ife.exitStartTimestamp != 0, "In-flight exit doesn't exists");

        require(
            ife.oldestCompetitorPosition > inFlightTxPos,
            "In-flight transaction has to be younger than competitors to respond to non-canonical challenge.");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(inFlightTxPos);
        (bytes32 root, ) = self.framework.blocks(utxoPos.blockNum());
        ife.oldestCompetitorPosition = verifyAndDeterminePositionOfTransactionIncludedInBlock(
            inFlightTx, utxoPos, root, inFlightTxInclusionProof
        );

        ife.isCanonical = true;
        ife.bondOwner = msg.sender;

        emit InFlightExitChallengeResponded(msg.sender, keccak256(inFlightTx), inFlightTxPos);
    }

    /**
     * @dev Checks that in-flight exit is in phase that allows for piggybacks and canonicity challenges.
     * @param ife in-flight exit to check.
     */
    function verifyFirstPhaseNotOver(
        PaymentExitDataModel.InFlightExit storage ife,
        uint256 minExitPeriod
    )
        private
        view
    {
        uint256 phasePeriod = minExitPeriod / 2;
        bool firstPhasePassed = ((block.timestamp - ife.exitStartTimestamp) / phasePeriod) >= 1;
        require(!firstPhasePassed, "Canonicity challege phase for this exit has ended");
    }

    function verifyAndDeterminePositionOfTransactionIncludedInBlock(
        bytes memory txbytes,
        UtxoPosLib.UtxoPos memory utxoPos,
        bytes32 root,
        bytes memory inclusionProof
    )
        private
        pure
        returns(uint256)
    {
        bytes32 leaf = keccak256(txbytes);
        require(
            Merkle.checkMembership(leaf, utxoPos.txIndex(), root, inclusionProof),
            "Transaction is not included in block of plasma chain"
        );

        return utxoPos.value;
    }
}













contract PaymentInFlightExitRouter is IExitProcessor, OnlyWithValue {
    using PaymentStartInFlightExit for PaymentStartInFlightExit.Controller;
    using PaymentPiggybackInFlightExit for PaymentPiggybackInFlightExit.Controller;
    using PaymentChallengeIFENotCanonical for PaymentChallengeIFENotCanonical.Controller;

    uint256 public constant IN_FLIGHT_EXIT_BOND = 31415926535 wei;
    uint256 public constant PIGGYBACK_BOND = 31415926535 wei;

    PaymentExitDataModel.InFlightExitMap internal inFlightExitMap;
    PaymentStartInFlightExit.Controller internal startInFlightExitController;
    PaymentPiggybackInFlightExit.Controller internal piggybackInFlightExitController;
    PaymentChallengeIFENotCanonical.Controller internal challengeCanonicityController;

    constructor(
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier verifier,
        uint256 supportedTxType
    )
        public
    {
        startInFlightExitController = PaymentStartInFlightExit.buildController(
            framework,
            outputGuardHandlerRegistry,
            spendingConditionRegistry,
            verifier,
            supportedTxType
        );

        piggybackInFlightExitController = PaymentPiggybackInFlightExit.buildController(
            framework,
            this,
            outputGuardHandlerRegistry
        );

        challengeCanonicityController = PaymentChallengeIFENotCanonical.Controller({
            framework: framework,
            spendingConditionRegistry: spendingConditionRegistry,
            supportedTxType: supportedTxType
        });
    }

    function inFlightExits(uint192 _exitId) public view returns (PaymentExitDataModel.InFlightExit memory) {
        return inFlightExitMap.exits[_exitId];
    }

    /**
     * @notice Starts withdrawal from a transaction that might be in-flight.
     * @param args input argument data to challenge. See struct 'StartExitArgs' for detailed info.
     */
    function startInFlightExit(PaymentInFlightExitRouterArgs.StartExitArgs memory args)
        public
        payable
        onlyWithValue(IN_FLIGHT_EXIT_BOND)
    {
        startInFlightExitController.run(inFlightExitMap, args);
    }

    /**
     * @notice Piggyback on an input of an in-flight exiting tx. Would be processed if the in-flight exit is non-canonical.
     * @param args input argument data to piggyback. See struct 'PiggybackInFlightExitOnInputArgs' for detailed info.
     */
    function piggybackInFlightExitOnInput(
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs memory args
    )
        public
        payable
        onlyWithValue(PIGGYBACK_BOND)
    {
        piggybackInFlightExitController.piggybackInput(inFlightExitMap, args);
    }

    /**
     * @notice Piggyback on an output of an in-flight exiting tx. Would be processed if the in-flight exit is canonical.
     * @param args input argument data to piggyback. See struct 'PiggybackInFlightExitOnOutputArgs' for detailed info.
     */
    function piggybackInFlightExitOnOutput(
        PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs memory args
    )
        public
        payable
        onlyWithValue(PIGGYBACK_BOND)
    {
        piggybackInFlightExitController.piggybackOutput(inFlightExitMap, args);
    }

    /**
     * @notice Challenges an in-flight exit to be non canonical.
     * @param args input argument data to challenge. See struct 'ChallengeCanonicityArgs' for detailed info.
     */
    function challengeInFlightExitNotCanonical(PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs memory args)
        public
    {
        challengeCanonicityController.challenge(inFlightExitMap, args);
    }

    function respondToNonCanonicalChallenge(
        bytes memory inFlightTx,
        uint256 inFlightTxPos,
        bytes memory inFlightTxInclusionProof
    )
        public
    {
        challengeCanonicityController.respond(inFlightExitMap, inFlightTx, inFlightTxPos, inFlightTxInclusionProof);
    }
}




contract PaymentInFlightExitRouterMock is PaymentInFlightExitRouter {
    constructor(
        PlasmaFramework framework,
        OutputGuardHandlerRegistry outputGuardHandlerRegistry,
        PaymentSpendingConditionRegistry spendingConditionRegistry,
        IStateTransitionVerifier verifier,
        uint256 supportedTxType
    )
        public
        PaymentInFlightExitRouter(framework, outputGuardHandlerRegistry, spendingConditionRegistry, verifier, supportedTxType)
    {
    }

    // to override IExitProcessor function
    function processExit(uint192 exitId) external {}

    function finalizeExit(uint192 exitId) public {
        inFlightExitMap.exits[exitId].exitStartTimestamp = 1;
        inFlightExitMap.exits[exitId].isFinalized = true;
    }

    function setInFlightExit(uint192 exitId, PaymentExitDataModel.InFlightExit memory exit) public {
        PaymentExitDataModel.InFlightExit storage ife = inFlightExitMap.exits[exitId];
        ife.exitStartTimestamp = exit.exitStartTimestamp;
        ife.exitMap = exit.exitMap;
        ife.position = exit.position;
        ife.bondOwner = exit.bondOwner;
        ife.oldestCompetitorPosition = exit.oldestCompetitorPosition;

        for (uint i = 0; i < exit.inputs.length; i++) {
            ife.inputs[i] = exit.inputs[i];
        }

        for (uint i = 0; i < exit.outputs.length; i++) {
            ife.outputs[i] = exit.outputs[i];
        }
    }

    function getInFlightExitInput(uint192 exitId, uint16 inputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].inputs[inputIndex];
    }

    function getInFlightExitOutput(uint192 exitId, uint16 outputIndex) public view returns (PaymentExitDataModel.WithdrawData memory) {
        return inFlightExitMap.exits[exitId].outputs[outputIndex];
    }
}



contract PaymentSpendingConditionTrue is IPaymentSpendingCondition {
    function verify(
        bytes32,
        uint256,
        bytes32,
        bytes calldata,
        uint8,
        bytes calldata
    ) external view returns (bool) {
        return true;
    }
}



contract PaymentSpendingConditionFalse is IPaymentSpendingCondition {
    function verify(
        bytes32,
        uint256,
        bytes32,
        bytes calldata,
        uint8,
        bytes calldata
    ) external view returns (bool) {
        return false;
    }
}



contract PaymentSpendingConditionExpected is IPaymentSpendingCondition {
    Expected private expected;
    
    struct Expected {
        bytes32 outputGuard;
        uint256 utxoPos;
        bytes32 outputId;
        bytes spendingTx;
        uint8 inputIndex;
        bytes witness;
    }

    function setExpected(Expected memory _expected) public {
        expected = _expected;
    }

    function verify(
        bytes32 _outputGuard,
        uint256 _utxoPos,
        bytes32 _outputId,
        bytes calldata _spendingTx,
        uint8 _inputIndex,
        bytes calldata _witness
    ) external view returns (bool) {
        require(expected.outputGuard == _outputGuard, "output guard not as expected");
        require(expected.utxoPos == _utxoPos, "utxo pos not as expected");
        require(expected.outputId == _outputId, "output id not as expected");
        require(compareBytes(expected.spendingTx, _spendingTx), "spending tx not as expected");
        require(expected.inputIndex == _inputIndex, "input index not as expected");
        require(compareBytes(expected.witness, _witness), "witness not as expected");

        return true;
    }

    function compareBytes(bytes memory a, bytes memory b) private pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}



contract PaymentSpendingConditionRevert is IPaymentSpendingCondition {
    string constant public REVERT_MESSAGE = "testing payment spending condition reverts";

    function verify(
        bytes32,
        uint256,
        bytes32,
        bytes calldata,
        uint8,
        bytes calldata
    ) external view returns (bool) {
        require(false, REVERT_MESSAGE);
    }
}



contract OutputGuardWrapper {
    function build(
        uint256 _outputType,
        bytes memory _outputGuardData
    )
        public
        pure
        returns (bytes20)
    {
        return OutputGuard.build(_outputType, _outputGuardData);
    }
}



contract OutputIdWrapper {
    function computeDepositOutputId(
        bytes memory _txBytes,
        uint8 _outputIndex,
        uint256 _utxoPosValue
    )
        public
        pure
        returns (bytes32)
    {
        return OutputId.computeDepositOutputId(_txBytes, _outputIndex, _utxoPosValue);
    }

    function computeNormalOutputId(
        bytes memory _txBytes,
        uint8 _outputIndex
    )
        public
        pure
        returns (bytes32)
    {
        return OutputId.computeNormalOutputId(_txBytes, _outputIndex);
    }
}




contract ExitIdWrapper {
    function isStandardExit(uint192 _exitId) public pure returns (bool) {
        return ExitId.isStandardExit(_exitId);
    }

    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint192)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint192)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}



contract TxFinalizationWrapper {
    function getVerifier(
        address framework,
        uint8 protocol,
        bytes memory txBytes,
        uint256 txPos,
        bytes memory inclusionProof,
        bytes memory confirmSig,
        address confirmSigAddress
    )
        public
        pure
        returns (TxFinalization.Verifier memory)
    {
        return TxFinalization.Verifier({
            framework: PlasmaFramework(framework),
            protocol: protocol,
            txBytes: txBytes,
            txPos: TxPosLib.TxPos(txPos),
            inclusionProof: inclusionProof,
            confirmSig: confirmSig,
            confirmSigAddress: confirmSigAddress
        });
    }

    function isStandardFinalized(TxFinalization.Verifier memory verifier) public view returns (bool) {
        return TxFinalization.isStandardFinalized(verifier);
    }

    function isProtocolFinalized(TxFinalization.Verifier memory verifier) public view returns (bool) {
        return TxFinalization.isProtocolFinalized(verifier);
    }
}



contract ExitableTimestampWrapper {
    using ExitableTimestamp for ExitableTimestamp.Calculator;
    ExitableTimestamp.Calculator internal calculator;

    constructor(uint256 _minExitPeriod) public {
        calculator = ExitableTimestamp.Calculator(_minExitPeriod);
    }

    function calculate(uint256 _now, uint256 _blockTimestamp, bool _isDeposit)
        public
        view
        returns (uint256)
    {
        return calculator.calculate(_now, _blockTimestamp, _isDeposit);
    }
}



contract StateTransitionVerifierReject is IStateTransitionVerifier {

    function isCorrectStateTransition(
        bytes calldata, /*inFlightTx*/
        bytes[] calldata, /*inputTxs*/
        uint256[] calldata /*inputUtxosPos*/
    )
        external
        view
        returns (bool)
    {
        return false;
    }
}




contract ExpectedOutputGuardHandler is IOutputGuardHandler {
    bool private expectedIsValid;
    address payable private expectedExitTarget;
    address private expectedConfirmSigAddress;
    OutputGuardModel.Data private expectedData;

    /** If this function is set, all tested method would check whether the argument is the same as expected */
    function shouldVerifyArgumentEquals(OutputGuardModel.Data memory data) public {
        expectedData = data;
    }

    /** Mock the isValid() function return value */
    function mockIsValid(bool isValid) public {
        expectedIsValid = isValid;
    }

    /** Mock the getExitTarget() function return value */
    function mockGetExitTarget(address payable exitTarget) public {
        expectedExitTarget = exitTarget;
    }

    /** Mock the getConfirmSigAddress() function return value  */
    function mockGetConfirmSigAddress(address payable confirmSigAddress) public {
        expectedConfirmSigAddress = confirmSigAddress;
    }

    /** overrride */
    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        require(isDataExpected(data), "Input args of 'isValid' function mismatch the expected data");
        return expectedIsValid;
    }

    /** overrride */
    function getExitTarget(OutputGuardModel.Data memory data) public view returns (address payable) {
        require(isDataExpected(data), "Input args of 'getExitTarget' function mismatch the expected data");
        return expectedExitTarget;
    }

    /** override */
    function getConfirmSigAddress(OutputGuardModel.Data memory data) public view returns (address) {
        require(isDataExpected(data), "Input args of 'getExitTgetConfirmSigAddressarget' function mismatch the expected data");
        return expectedConfirmSigAddress;
    }

    function isDataExpected(OutputGuardModel.Data memory data) private view returns (bool) {
        // only test this when expected data is set. So we can tune only small portion of tests need to set this up.
        if (expectedData.guard == bytes20(""))
            return true;

        return data.guard == expectedData.guard &&
            data.outputType == expectedData.outputType &&
            keccak256(data.preimage) == keccak256(expectedData.preimage);
    }
}





contract SpyPlasmaFrameworkForExitGame is PlasmaFramework {
    uint256 public enqueuedCount = 0;
    mapping (uint256 => BlockModel.Block) public blocks;

    event EnqueueTriggered(
        address token,
        uint64 exitableAt,
        uint256 txPos,
        uint256 exitId,
        address exitProcessor
    );

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneVaults, uint256 _initialImmuneExitGames)
        public
        PlasmaFramework(_minExitPeriod, _initialImmuneVaults, _initialImmuneExitGames)
    {
    }

    /** override for test */
    function enqueue(address _token, uint64 _exitableAt, TxPosLib.TxPos calldata _txPos, uint192 _exitId, IExitProcessor _exitProcessor)
        external
        returns (uint256)
    {
        enqueuedCount += 1;
        emit EnqueueTriggered(
            _token,
            _exitableAt,
            _txPos.value,
            _exitId,
            address(_exitProcessor)
        );
        return enqueuedCount;
    }

    /**
     Custom test helpers
     */
    function setBlock(uint256 _blockNum, bytes32 _root, uint256 _timestamp) external {
        blocks[_blockNum] = BlockModel.Block(_root, _timestamp);
    }
}


contract StateTransitionVerifierReverse is IStateTransitionVerifier {

    function isCorrectStateTransition(
        bytes calldata, /*inFlightTx*/
        bytes[] calldata, /*inputTxs*/
        uint256[] calldata /*inputUtxosPos*/
    )
        external
        view
        returns (bool)
    {
        require(false, "Failing on purpose");
    }
}

contract SpendingConditionMock is ISpendingCondition {
    bool internal expectedResult;
    bool internal shouldRevert;
    Args internal expectedArgs;

    string constant internal REVERT_MESSAGE = "Test spending condition reverts";

    struct Args {
        bytes inputTx;
        uint16 outputIndex;
        uint256 inputTxPos;
        bytes spendingTx;
        uint16 inputIndex;
        bytes witness;
        bytes optionalArgs;
    }

    /** mock what would "verify()" returns */
    function mockResult(bool result) public {
        expectedResult = result;
    }

    /** when called, the spending condition would always revert on purpose */
    function mockRevert() public {
        shouldRevert = true;
    }

    /** provide the expected args, it would check with the value called for "verify()" */
    function shouldVerifyArgumentEquals(Args memory args) public {
        expectedArgs = args;
    }

    /** override */
    function verify(
        bytes calldata inputTx,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTx,
        uint16 inputIndex,
        bytes calldata witness,
        bytes calldata optionalArgs
    )
        external
        view
        returns (bool)
    {
        if (shouldRevert) {
            // TODO: solhint disabled for now due to bug, https://github.com/protofire/solhint/issues/157
            // solhint-disable-next-line reason-string
            revert(REVERT_MESSAGE);
        }

        // only run the check when "shouldVerifyArgumentEqauals" is called
        if (expectedArgs.inputTx.length > 0) {
            require(keccak256(expectedArgs.inputTx) == keccak256(inputTx), "input tx not as expected");
            require(expectedArgs.outputIndex == outputIndex, "output index not as expected");
            require(expectedArgs.inputTxPos == inputTxPos, "input tx pos not as expected");
            require(keccak256(expectedArgs.spendingTx) == keccak256(spendingTx), "spending tx not as expected");
            require(expectedArgs.inputIndex == inputIndex, "input index not as expected");
            require(keccak256(expectedArgs.witness) == keccak256(witness), "witness not as expected");
            require(keccak256(expectedArgs.optionalArgs) == keccak256(optionalArgs), "optional args not as expected");
        }
        return expectedResult;
    }
}



contract Erc20DepositVerifier is IErc20DepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    uint8 constant internal DEPOSIT_TX_TYPE = 1;

    function verify(bytes calldata _depositTx, address _sender, address _vault)
        external
        view
        returns (
            address owner,
            address token,
            uint256 amount
        )
    {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        require(decodedTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(decodedTx.inputs.length == 0, "Deposit must have no inputs");

        require(decodedTx.outputs.length == 1, "Deposit must have exactly one output");
        require(decodedTx.outputs[0].token != address(0), "Invalid output currency (ETH)");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == _sender, "Depositor's address does not match sender's address");

        IERC20 erc20 = IERC20(decodedTx.outputs[0].token);
        require(erc20.allowance(depositorsAddress, _vault) == decodedTx.outputs[0].amount, "Tokens have not been approved");

        return (depositorsAddress, decodedTx.outputs[0].token, decodedTx.outputs[0].amount);
    }
}



contract EthDepositVerifier is IEthDepositVerifier {
    using DepositOutputModel for DepositOutputModel.Output;

    uint8 constant internal DEPOSIT_TX_TYPE = 1;

    function verify(bytes calldata _depositTx, uint256 amount, address _sender) external view {
        DepositTx.Transaction memory decodedTx = DepositTx.decode(_depositTx);

        require(decodedTx.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        require(decodedTx.inputs.length == 0, "Deposit must have no inputs");

        require(decodedTx.outputs.length == 1, "Deposit must have exactly one output");
        require(decodedTx.outputs[0].amount == amount, "Deposited value does not match sent amount");
        require(decodedTx.outputs[0].token == address(0), "Output does not have correct currency (ETH)");

        address depositorsAddress = decodedTx.outputs[0].owner();
        require(depositorsAddress == _sender, "Depositor's address does not match sender's address");
    }
}







/*
* Verifies state transitions for payment transaction
*/
contract PaymentTransactionStateTransitionVerifier {

    struct StateTransitionArgs {
        bytes inFlightTx;
        bytes[] inputTxs;
        uint256[] inputUtxosPos;
    }

    function isCorrectStateTransition(
        bytes calldata inFlightTx,
        bytes[] calldata inputTxs,
        uint256[] calldata inputUtxosPos
    )
        external
        pure
        returns (bool)
    {
        if (inputTxs.length != inputUtxosPos.length) {
            return false;
        }

        //TODO: refactor that to smaller function as soon as this issue is resolved: https://github.com/ethereum/solidity/issues/6835
        WireTransaction.Output[] memory inputs = new WireTransaction.Output[](inputTxs.length);
        for (uint i = 0; i < inputTxs.length; i++) {
            uint16 outputIndex = UtxoPosLib.outputIndex(UtxoPosLib.UtxoPos(inputUtxosPos[i]));
            WireTransaction.Output memory output = WireTransaction.getOutput(inputTxs[i], outputIndex);
            inputs[i] = output;
        }

        WireTransaction.Output[] memory outputs = new WireTransaction.Output[](inputTxs.length);
        PaymentTransactionModel.Transaction memory transaction = PaymentTransactionModel.decode(inFlightTx);
        for (uint i = 0; i < transaction.outputs.length; i++) {
            outputs[i] = WireTransaction.Output(transaction.outputs[i].amount, transaction.outputs[i].outputGuard, transaction.outputs[i].token);
        }

        return _isCorrectStateTransition(inputs, outputs);
    }

    function _isCorrectStateTransition(
        WireTransaction.Output[] memory inputs,
        WireTransaction.Output[] memory outputs
    )
        private
        pure
        returns (bool)
    {
        bool correctTransition = true;
        uint i = 0;
        while (correctTransition && i < outputs.length) {
            address token = outputs[i].token;
            WireTransaction.Output[] memory inputsForToken = filterWithToken(inputs, token);
            WireTransaction.Output[] memory outputsForToken = filterWithToken(outputs, token);

            correctTransition = isCorrectSpend(inputsForToken, outputsForToken);
            i += 1;
        }
        return correctTransition;
    }

    function filterWithToken(
        WireTransaction.Output[] memory outputs,
        address token
    )
        private
        pure
        returns (WireTransaction.Output[] memory)
    {
        // it is needed to calculate the size of the filtered array
        uint256 arraySize = 0;
        for (uint i = 0; i < outputs.length; ++i) {
            if (outputs[i].token == token) {
                arraySize += 1;
            }
        }

        WireTransaction.Output[] memory outputsWithToken = new WireTransaction.Output[](arraySize);
        uint j = 0;
        for (uint i = 0; i < outputs.length; ++i) {
            if (outputs[i].token == token) {
                outputsWithToken[j] = outputs[i];
                j += 1;
            }
        }

        return outputsWithToken;
    }

    function isCorrectSpend(
        WireTransaction.Output[] memory inputs,
        WireTransaction.Output[] memory outputs
    )
        internal
        pure
        returns (bool)
    {
        uint256 amountIn = sumAmounts(inputs);
        uint256 amountOut = sumAmounts(outputs);
        return amountIn >= amountOut;
    }

    function sumAmounts(WireTransaction.Output[] memory outputs) private pure returns (uint256) {
        uint256 amount = 0;
        for (uint i = 0; i < outputs.length; i++) {
            amount += outputs[i].amount;
        }
        return amount;
    }
}








contract PaymentExitGame is IExitProcessor, PaymentStandardExitRouter {
    constructor(
        PlasmaFramework _framework,
        EthVault _ethVault,
        Erc20Vault _erc20Vault,
        OutputGuardHandlerRegistry _outputGuardHandlerRegistry,
        SpendingConditionRegistry _spendingConditionRegistry
    )
        public
        PaymentStandardExitRouter(_framework, _ethVault, _erc20Vault, _outputGuardHandlerRegistry, _spendingConditionRegistry)
    {
    }

    function processExit(uint192 _exitId) external {
        if (ExitId.isStandardExit(_exitId)) {
            PaymentStandardExitRouter.processStandardExit(_exitId);
        } else {
            require(false, "TODO: implement process in flight exit");
        }
    }

    function getStandardExitId(bool _isDeposit, bytes memory _txBytes, uint256 _utxoPos)
        public
        pure
        returns (uint192)
    {
        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.UtxoPos(_utxoPos);
        return ExitId.getStandardExitId(_isDeposit, _txBytes, utxoPos);
    }

    function getInFlightExitId(bytes memory _txBytes)
        public
        pure
        returns (uint192)
    {
        return ExitId.getInFlightExitId(_txBytes);
    }
}





contract PaymentOutputGuardHandler is IOutputGuardHandler {
    uint256 internal outputType;

    constructor(uint256 _outputType) public {
        outputType = _outputType;
    }

    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        require(data.preimage.length == 0, "Pre-imgage of the output guard should be empty");
        require(data.outputType == outputType, "Output type mismatch");
        return true;
    }

    function getExitTarget(OutputGuardModel.Data calldata data) external view returns (address payable) {
        return AddressPayable.convert(address(uint160(data.guard)));
    }

    function getConfirmSigAddress(OutputGuardModel.Data calldata /*data*/)
        external
        view
        returns (address)
    {
        // MoreVP transaction, no need to have confirm sig.
        return address(0);
    }
}

// File: contracts/src/exits/payment/spendingConditions/PaymentOutputToPaymentTxCondition.sol









contract PaymentOutputToPaymentTxCondition is ISpendingCondition {
    using PaymentEip712Lib for PaymentEip712Lib.Constants;
    using PaymentOutputModel for PaymentOutputModel.Output;
    using TxPosLib for TxPosLib.TxPos;

    uint256 internal supportInputTxType;
    uint256 internal supportSpendingTxType;
    PaymentEip712Lib.Constants internal eip712;

    constructor(address framework, uint256 inputTxType, uint256 spendingTxType) public {
        eip712 = PaymentEip712Lib.initConstants(framework);
        supportInputTxType = inputTxType;
        supportSpendingTxType = spendingTxType;
    }

    /**
     * @notice Verifies the spending condition
     * @param inputTxBytes encoded input transaction in bytes
     * @param outputIndex the output index of the input transaction
     * @param inputTxPos the tx position of the input tx. (0 if in-flight)
     * @param spendingTxBytes spending transaction in bytes
     * @param inputIndex the input index of the spending tx that points to the output
     * @param signature signature of the output owner
     */
    function verify(
        bytes calldata inputTxBytes,
        uint16 outputIndex,
        uint256 inputTxPos,
        bytes calldata spendingTxBytes,
        uint16 inputIndex,
        bytes calldata signature,
        bytes calldata /*optionalArgs*/
    )
        external
        view
        returns (bool)
    {
        PaymentTransactionModel.Transaction memory inputTx = PaymentTransactionModel.decode(inputTxBytes);
        require(inputTx.txType == supportInputTxType, "The input tx is not of the supported payment tx type");

        PaymentTransactionModel.Transaction memory spendingTx = PaymentTransactionModel.decode(spendingTxBytes);
        require(spendingTx.txType == supportSpendingTxType, "The spending tx is not of the supported payment tx type");

        UtxoPosLib.UtxoPos memory utxoPos = UtxoPosLib.build(TxPosLib.TxPos(inputTxPos), outputIndex);
        require(
            spendingTx.inputs[inputIndex] == bytes32(utxoPos.value),
            "The spending tx does not point to the correct utxo position of the output"
        );

        address payable owner = inputTx.outputs[outputIndex].owner();
        require(owner == ECDSA.recover(eip712.hashTx(spendingTx), signature), "Tx not correctly signed");

        return true;
    }
}


contract Migrations {
  address public owner;
  uint public last_completed_migration;

  constructor() public {
    owner = msg.sender;
  }

  modifier restricted() {
    if (msg.sender == owner) _;
  }

  function setCompleted(uint completed) public restricted {
    last_completed_migration = completed;
  }

  function upgrade(address new_address) public restricted {
    Migrations upgraded = Migrations(new_address);
    upgraded.setCompleted(last_completed_migration);
  }
}


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



library BlockModel {
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }
}



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



interface IExitProcessor {
    /**
     * @dev Custom function to process exit. Would do nothing if not able to exit (eg. successfully challenged)
     * @param _exitId unique id for exit per tx type.
     */
    function processExit(uint192 _exitId) external;
}



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


interface IEthDepositVerifier {
    /**
     * @notice Verifies a deposit transaction.
     * @param _depositTx The deposit transaction.
     * @param _amount The amount being of the deposited.
     * @param _sender The owner of the deposit transaction.
     */
    function verify(bytes calldata _depositTx, uint256 _amount, address _sender) external view;
}





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
