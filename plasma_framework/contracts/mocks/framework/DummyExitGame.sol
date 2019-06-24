pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/framework/interfaces/ExitProcessor.sol";

contract DummyExitGame is ExitProcessor {
    uint256 public uniquePriorityFromEnqueue;

    ExitGameRegistryMock private exitGameRegistry;
    ExitGameController private exitGameController;

    event ExitFinalizedFromDummyExitGame (
        uint256 indexed exitId
    );

    // override ExitProcessor interface
    function processExit(uint256 _exitId) public {
        emit ExitFinalizedFromDummyExitGame(_exitId);
    }

    // setter function only for test, not a real Exit Game function
    function setExitGameRegistry(address _contract) public {
        exitGameRegistry = ExitGameRegistryMock(_contract);
    }

    function checkOnlyFromExitGame() public {
        exitGameRegistry.checkOnlyFromExitGame();
    }

    // setter function only for test, not a real Exit Game function
    function setExitGameController(address _contract) public {
        exitGameController = ExitGameController(_contract);
    }

    function enqueue(uint192 _priority, address _token, ExitModel.Exit memory _exit) public {
        uniquePriorityFromEnqueue = exitGameController.enqueue(_priority, _token, _exit);
    }
}
