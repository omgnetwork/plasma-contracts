pragma solidity ^0.5.0;

import "./PriorityQueueLib.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title PriorityQueue
 * @dev Min-heap priority queue implementation.
 */
contract PriorityQueue is Ownable {
    using PriorityQueueLib for PriorityQueueLib.Queue;

    PriorityQueueLib.Queue queue;

    constructor(address _owner) public {
        queue.init(_owner);
    }

    /**
     * @notice Inserts an element into the queue.
     * @dev Does not perform deduplication.
     */
    function insert(uint256 _element) public onlyOwner {
        queue.insert(_element);
    }

    /**
     * @notice Deletes the top element of the heap and shifts everything up.
     * @return The smallest element in the priority queue.
     */
    function delMin() public onlyOwner returns (uint256) {
        return queue.delMin();
    }

    /**
     * @notice Returns the top element of the heap.
     * @dev Fails when queue is empty
     * @return The smallest element in the priority queue.
     */
    function getMin() public view returns (uint256) {
        return queue.getMin();
    }

    function currentSize() external view returns (uint256) {
        return queue.getCurrentSize();
    }
}
