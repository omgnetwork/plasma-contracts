pragma solidity 0.5.11;

library AddressPayable {

    /**
     * @notice Converts an `address` into `address payable`.
     * @dev Note that this is simply a type cast: the actual underlying value is not changed.
     */
    function convert(address account) internal pure returns (address payable) {
        return address(uint160(account));
    }
}
