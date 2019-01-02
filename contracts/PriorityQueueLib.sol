pragma solidity ^0.4.0;

import "./SafeMath.sol";

/**
 * @title PriorityQueueLib
 * @dev A priority queue library implementation
 */
library PriorityQueueLib {
    using SafeMath for uint256;

    /*
     *  Storage definition
     */
    struct Queue {
        address owner;
        uint256[] heapList;
        uint256 currentSize;
    }

    /*
     *  Public functions
     */

    function isOwner(Queue storage self)
        internal
        returns (bool)
    {
        return msg.sender == self.owner;
    }

    function init(Queue storage self, address _owner)
    {
        self.owner = _owner;
        self.heapList = [0];
        self.currentSize = 0;
    }

    function insert(Queue storage self, uint256 k)
    {
        self.heapList.push(k);
        self.currentSize = self.currentSize.add(1);
        percUp(self, self.currentSize);
    }

    function minChild(Queue storage self, uint256 i)
        view
        returns (uint256)
    {
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

    function getMin(Queue storage self)
        view
        internal
        returns (uint256)
    {
        return self.heapList[1];
    }

    function delMin(Queue storage self)
        returns (uint256)
    {
        uint256 retVal = self.heapList[1];
        self.heapList[1] = self.heapList[self.currentSize];
        delete self.heapList[self.currentSize];
        self.currentSize = self.currentSize.sub(1);
        percDown(self, 1);
        self.heapList.length = self.heapList.length.sub(1);
        return retVal;
    }

    function getCurrentSize(Queue storage self)
        view
        internal
        returns (uint256)
    {
        return self.currentSize;
    }

    /*
     *  Private functions
     */
    function percUp(Queue storage self, uint256 i)
        private
    {
        uint256 j = i;
        uint256 newVal = self.heapList[i];
        while (newVal < self.heapList[i.div(2)]) {
            self.heapList[i] = self.heapList[i.div(2)];
            i = i.div(2);
        }
        if (i != j) self.heapList[i] = newVal;
    }

    function percDown(Queue storage self, uint256 i)
        private
    {
        uint256 j = i;
        uint256 newVal = self.heapList[i];
        uint256 mc = minChild(self, i);
        while (mc <= self.currentSize && newVal > self.heapList[mc]) {
            self.heapList[i] = self.heapList[mc];
            i = mc;
            mc = minChild(self, i);
        }
        if (i != j) self.heapList[i] = newVal;
    }
}
