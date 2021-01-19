pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/framework/BlockController.sol";

contract BlockControllerMock is BlockController {
    address private maintainer;

    constructor(
        uint256 interval,
        uint256 minExitPeriod,
        uint256 initialImmuneVaults,
        address authority
    )
        public
        BlockController(
            interval,
            minExitPeriod,
            initialImmuneVaults,
            authority
        )
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

    function setBlock(uint256 _blockNum, bytes32 _root, uint256 _timestamp) external {
        blocks[_blockNum] = BlockModel.Block(_root, _timestamp);
    }

    /**
     * this returns the contract address when quasar contract needs the exit game
     */
    function exitGames(uint256 _txType) public view returns (address) {
        return address(this);
    }
}
