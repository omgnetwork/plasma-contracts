pragma solidity ^0.5.0;
import "../../../src/framework/utils/PriorityQueue.sol";

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
