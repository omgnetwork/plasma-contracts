pragma solidity ^0.4.0;

import "./PriorityQueueLib.sol";

/**
 * @title PriorityQueue
 * @dev Min-heap priority queue implementation.
 */
contract PriorityQueueTest {
    using PriorityQueueLib for PriorityQueueLib.Queue;
    /*
     *  Modifiers
     */

    modifier onlyOwner() {
        require(queue.isOwner());
        _;
    }

    /*
     * Events
     */

     event DelMin(uint256 val);

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

    /**
     * @dev Inserts an element into the queue. Does not perform deduplication.
     */
    function insert(uint256 _element)
        onlyOwner
        public
    {
        queue.insert(_element);
    }


    /**
     * @dev Overrides the default implementation, by simply emitting an even on deletion, so that the result is testable.
     * @return The smallest element in the priority queue.
     */
    function delMin()
        onlyOwner
        public
        returns (uint256 value)
    {
        value = queue.delMin();
        emit DelMin(value);
    }


    /*
     * Read-only functions
     */

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

    function currentSize()
        external
        view
        returns (uint256)
    {
        return queue.getCurrentSize();
    }

}
