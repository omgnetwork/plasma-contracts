pragma solidity ^0.4.0;

import "./PriorityQueueLib.sol";

/**
 * @title PriorityQueue
 * @dev Min-heap priority queue implementation.
 */
contract PriorityQueue {
    using PriorityQueueLib for PriorityQueueLib.Queue;

    /*
     *  Modifiers
     */

    modifier onlyOwner() {
        require(queue.isOwner());
        _;
    }

    /*
     *  Storage
     */

    PriorityQueueLib.Queue queue;

    /*
     *  Public functions
     */

    constructor(address _owner)
        public
    {
        queue.init(_owner);
    }

    function currentSize()
        external
        view
        returns (uint256)
    {
        return queue.getCurrentSize();
    }

    function insert(uint256 _element)
        onlyOwner
        public
    {
        queue.insert(_element);
    }

    function minChild(uint256 i)
        public
        view
        returns (uint256)
    {
        return queue.minChild(i);
    }

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

    /**
     * @dev Deletes the top element of the heap and shifts everything up.
     * @return The smallest element in the priority queue.
     */
    function delMin()
        onlyOwner
        public
        returns (uint256)
    {
        return queue.delMin();
    }

}
