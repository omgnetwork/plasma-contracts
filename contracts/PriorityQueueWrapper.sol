pragma solidity ^0.4.0;

import "./PriorityQueueLib.sol";

/**
 * @title PriorityQueueWrapper
 * @dev PriorityQueue wrapper that emits event at element deletion, making the PQ testable in web3 framework. 
 */
contract PriorityQueueWrapper {
    using PriorityQueueLib for PriorityQueueLib.Queue;

     event DelMin(uint256 val);

    PriorityQueueLib.Queue queue;

    constructor(address _owner)
        public
    {
        queue.init(_owner);
    }

    function insert(uint256 _element)
        public
    {
        queue.insert(_element);
    }

    function delMin()
        public
        returns (uint256 value)
    {
        value = queue.delMin();
        emit DelMin(value);
    }

    function minChild(uint256 i)
        public
        view
        returns (uint256)
    {
        return queue.minChild(i);
    }

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
