pragma solidity ^0.4.0;

import "./SafeMath.sol";

contract PriorityQueue {
    using SafeMath for uint256;

    /* 
     *  Storage
     */

    address owner;
    uint256[] heapList;
    uint256 public currentSize;


    /*
     *  Modifiers
     */

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }


    /*
     * Constructor
     */

    constructor()
        public
    {
        owner = msg.sender;
        heapList = [0];
        currentSize = 0;
    }


    /*
     * Internal functions
     */

    /**
     * @dev Inserts an element into the priority queue.
     * @param _element Integer to insert.
     */
    function insert(uint256 _element) 
        public
        onlyOwner
    {
        heapList.push(_element);
        currentSize = currentSize.add(1);
        _percUp(currentSize);
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
        return heapList[1];
    }

    /**
     * @dev Deletes the top element of the heap and shifts everything up.
     * @return The smallest element in the priorty queue.
     */
    function delMin()
        public
        onlyOwner
        returns (uint256)
    {
        uint256 retVal = heapList[1];
        heapList[1] = heapList[currentSize];
        delete heapList[currentSize];
        currentSize = currentSize.sub(1);
        _percDown(1);
        heapList.length = heapList.length.sub(1);
        return retVal;
    }


    /*
     * Private functions
     */

    /**
     * @dev Determines the minimum child of a given node in the tree.
     * @param _index Index of the node in the tree.
     * @return The smallest child node.
     */
    function _minChild(uint256 _index)
        private
        view
        returns (uint256)
    {
        if (_index.mul(2).add(1) > currentSize) {
            return _index.mul(2);
        } else {
            if (heapList[_index.mul(2)] < heapList[_index.mul(2).add(1)]) {
                return _index.mul(2);
            } else {
                return _index.mul(2).add(1);
            }
        }
    }

    /**
     * @dev Bubbles the element at some index up.
     */
    function _percUp(uint256 _index)
        private
    {
        uint256 index = _index;
        uint256 j = index;
        uint256 newVal = heapList[index];
        while (newVal < heapList[index.div(2)]) {
            heapList[index] = heapList[index.div(2)];
            index = index.div(2);
        }
        if (index != j) heapList[index] = newVal;
    }

    /**
     * @dev Bubbles the element at some index down.
     */
    function _percDown(uint256 _index)
        private
    {
        uint256 index = _index;
        uint256 j = index;
        uint256 newVal = heapList[index];
        uint256 mc = _minChild(index);
        while (mc <= currentSize && newVal > heapList[mc]) {
            heapList[index] = heapList[mc];
            index = mc;
            mc = _minChild(index);
        }
        if (index != j) heapList[index] = newVal;
    }
}
