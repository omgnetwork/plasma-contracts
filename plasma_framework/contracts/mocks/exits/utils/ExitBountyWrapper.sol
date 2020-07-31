pragma solidity 0.5.11;

import "../../../src/exits/utils/ExitBounty.sol";

contract ExitBountyWrapper {

    function processStandardExitBountySize() public view returns (uint256) {
        return ExitBounty.processStandardExitBountySize();
    }

}
