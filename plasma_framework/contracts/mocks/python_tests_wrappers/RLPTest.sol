pragma solidity ^0.5.0;

import "../../src/utils/RLP.sol";


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
