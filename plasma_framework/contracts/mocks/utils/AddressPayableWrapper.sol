pragma solidity 0.5.11;

import "../../src/utils/AddressPayable.sol";

contract AddressPayableWrapper {

    function convert(address _address)
        public
        pure
        returns (address payable)
    {
        return AddressPayable.convert(_address);
    }
}
