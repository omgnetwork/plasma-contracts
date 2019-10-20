pragma solidity ^0.5.0;

import "../../src/utils/RLPReader.sol";


/**
 * @title RLPTest
 * @dev Contract for testing RLP decoding.
 */
contract RLPTest {
    function eight(bytes memory tx_bytes)
        public
        pure
        returns (uint256, address, address)
    {
        RLPReader.RLPItem[] memory txList = RLPReader.toList(RLPReader.toRlpItem(tx_bytes));
        return (
            RLPReader.toUint(txList[5]),
            RLPReader.toAddress(txList[6]),
            RLPReader.toAddress(txList[7])
        );
    }

    function eleven(bytes memory tx_bytes)
        public
        pure
        returns (uint256, address, address, address)
    {
        RLPReader.RLPItem[] memory  txList = RLPReader.toList(RLPReader.toRlpItem(tx_bytes));
        return (
            RLPReader.toUint(txList[7]),
            RLPReader.toAddress(txList[8]),
            RLPReader.toAddress(txList[9]),
            RLPReader.toAddress(txList[10])
        );
    }
}
