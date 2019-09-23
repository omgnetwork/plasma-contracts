pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

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
