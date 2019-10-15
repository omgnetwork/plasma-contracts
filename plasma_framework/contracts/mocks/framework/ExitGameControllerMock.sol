pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/framework/ExitGameController.sol";

contract ExitGameControllerMock is ExitGameController {
    address private maintainer;

    constructor(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)
        public
        ExitGameController(_minExitPeriod, _initialImmuneExitGames)
    {
        maintainer = msg.sender;
    }

    /** 
     * override to make it non-abstract contract 
     * this mock file set the user that deploys the contract as maintainer to simplify the test.
     */
    function getMaintainer() public view returns (address) {
        return maintainer;
    }
}
