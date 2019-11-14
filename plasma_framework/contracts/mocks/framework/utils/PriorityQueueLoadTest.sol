pragma solidity 0.5.11;

import "../../../src/framework/utils/PriorityQueue.sol";

contract PriorityQueueLoadTest is PriorityQueue {

    /**
     * Helper function to inject heap data. It only appends batch of data to the end of array used as heap.
     * The client using this should make sure the data is in the order of an valid heap.
     */
    function setHeapData(uint256[] calldata heapList) external {
        for (uint i = 0; i < heapList.length; i++) {
            PriorityQueue.queue.heapList.push(heapList[i]);
        }
        PriorityQueue.queue.currentSize += heapList.length;
    }
}
