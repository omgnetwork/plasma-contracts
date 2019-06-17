pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/framework/interfaces/ExitProcessor.sol";

contract DummyExitGame is ExitProcessor {
    uint256 public uniqueuPriorityFromEnqueue;
    uint256 public exitIdProcessed;

    ExitGameRegistryMock private exitGameRegistry;
    ExitGameController private exitGameController;

    // override ExitProcessor interface
    function processExit(uint256 _exitId) public {
        exitIdProcessed = _exitId;
    }

    function setExitGameRegistry(address _contract) public {
        exitGameRegistry = ExitGameRegistryMock(_contract);
    }

    function checkOnlyFromExitGame() public {
        exitGameRegistry.checkOnlyFromExitGame();
    }

    function setExitGameController(address _contract) public {
        exitGameController = ExitGameController(_contract);
    }

    function enqueue(uint192 _priority, address _token, ExitModel.Exit memory _exit) public {
        uniqueuPriorityFromEnqueue = exitGameController.enqueue(_priority, _token, _exit);
    }
}