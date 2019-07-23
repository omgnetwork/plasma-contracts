pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/vaults/interfaces/IErc20Vault.sol";
import "../../src/vaults/interfaces/IEthVault.sol";
import "../../src/framework/interfaces/IExitProcessor.sol";

contract DummyExitGame is IExitProcessor {
    uint256 public uniquePriorityFromEnqueue;

    ExitGameRegistryMock private exitGameRegistry;
    ExitGameController private exitGameController;
    IEthVault private ethVault;
    IErc20Vault private erc20Vault;

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

    function checkOnlyFromNonQuarantinedExitGame() public view returns (bool) {
        return exitGameRegistry.checkOnlyFromNonQuarantinedExitGame();
    }

    // setter function only for test, not a real Exit Game function
    function setExitGameController(address _contract) public {
        exitGameController = ExitGameController(_contract);
    }

    function enqueue(uint192 _priority, address _token, ExitModel.Exit memory _exit) public {
        uniquePriorityFromEnqueue = exitGameController.enqueue(_priority, _token, _exit);
    }

    function proxyBatchFlagOutputsSpent(bytes32[] memory _outputIds) public {
        exitGameController.batchFlagOutputsSpent(_outputIds);
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        exitGameController.flagOutputSpent(_outputId);
    }

    // setter function only for test, not a real Exit Game function
    function setEthVault(address _contract) public {
        ethVault = IEthVault(_contract);
    }

    function proxyEthWithdraw(address payable _target, uint256 _amount) public {
        ethVault.withdraw(_target, _amount);
    }

    // setter function only for test, not a real Exit Game function
    function setErc20Vault(address _contract) public {
        erc20Vault = IErc20Vault(_contract);
    }

    function proxyErc20Withdraw(address payable _target, address _token, uint256 _amount) public {
        erc20Vault.withdraw(_target, _token, _amount);
    }
}
