pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/vaults/Erc20Vault.sol";
import "../../src/vaults/EthVault.sol";
import "../../src/framework/interfaces/IExitProcessor.sol";

contract DummyExitGame is IExitProcessor {
    uint256 public uniquePriorityFromEnqueue;

    ExitGameRegistryMock public exitGameRegistry;
    ExitGameController public exitGameController;
    EthVault public ethVault;
    Erc20Vault public erc20Vault;

    event ExitFinalizedFromDummyExitGame (
        uint256 indexed exitId
    );

    // override ExitProcessor interface
    function processExit(uint192 _exitId) public {
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

    function enqueue(address _token, uint64 _exitableAt, uint192 _exitId, IExitProcessor _exitProcessor) public {
        uniquePriorityFromEnqueue = exitGameController.enqueue(_token, _exitableAt, _exitId, _exitProcessor);
    }

    function proxyBatchFlagOutputsSpent(bytes32[] memory _outputIds) public {
        exitGameController.batchFlagOutputsSpent(_outputIds);
    }

    function proxyFlagOutputSpent(bytes32 _outputId) public {
        exitGameController.flagOutputSpent(_outputId);
    }

    // setter function only for test, not a real Exit Game function
    function setEthVault(EthVault _vault) public {
        ethVault = _vault;
    }

    function proxyEthWithdraw(address payable _target, uint256 _amount) public {
        ethVault.withdraw(_target, _amount);
    }

    // setter function only for test, not a real Exit Game function
    function setErc20Vault(Erc20Vault _vault) public {
        erc20Vault = _vault;
    }

    function proxyErc20Withdraw(address payable _target, address _token, uint256 _amount) public {
        erc20Vault.withdraw(_target, _token, _amount);
    }
}
