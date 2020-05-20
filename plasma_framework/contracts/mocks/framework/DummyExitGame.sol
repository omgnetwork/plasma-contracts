pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./registries/ExitGameRegistryMock.sol";
import "../../src/framework/ExitGameController.sol";
import "../../src/framework/interfaces/IExitProcessor.sol";
import "../../src/vaults/Erc20Vault.sol";
import "../../src/vaults/EthVault.sol";
import "../../src/utils/PosLib.sol";

contract DummyExitGame is IExitProcessor {
    uint256 public priorityFromEnqueue;

    ExitGameRegistryMock public exitGameRegistry;
    ExitGameController public exitGameController;
    EthVault public ethVault;
    Erc20Vault public erc20Vault;

    event ExitFinalizedFromDummyExitGame (
        uint256 indexed exitId,
        uint256 vaultId,
        address ercContract
    );

    // override ExitProcessor interface
    function processExit(uint168 exitId, uint256 vaultId, address ercContract) public {
        emit ExitFinalizedFromDummyExitGame(exitId, vaultId, ercContract);
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

    function enqueue(uint256 vaultId, address token, uint64 exitableAt, uint256 txPos, uint168 exitId, IExitProcessor exitProcessor)
        public
    {
        priorityFromEnqueue = exitGameController.enqueue(vaultId, token, exitableAt, PosLib.decode(txPos), exitId, exitProcessor);
    }

    function proxyBatchFlagOutputsFinalized(bytes32[] memory outputIds, uint168 exitId) public {
        exitGameController.batchFlagOutputsFinalized(outputIds, exitId);
    }

    function proxyFlagOutputFinalized(bytes32 outputId, uint168 exitId) public {
        exitGameController.flagOutputFinalized(outputId, exitId);
    }

    // setter function only for test, not a real Exit Game function
    function setEthVault(EthVault vault) public {
        ethVault = vault;
    }

    function proxyEthWithdraw(address payable target, uint256 amount) public {
        ethVault.withdraw(target, amount);
    }

    // setter function only for test, not a real Exit Game function
    function setErc20Vault(Erc20Vault vault) public {
        erc20Vault = vault;
    }

    function proxyErc20Withdraw(address payable target, address token, uint256 amount) public {
        erc20Vault.withdraw(target, token, amount);
    }
}
