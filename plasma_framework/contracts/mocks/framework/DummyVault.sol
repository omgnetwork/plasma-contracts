pragma solidity ^0.5.0;

import "./registries/VaultRegistryMock.sol";
import "../../src/framework/BlockController.sol";

contract DummyVault {
    VaultRegistryMock vaultRegistry;
    BlockController blockController;

    // setter function only for test, not a real Vault function
    function setVaultRegistry(address _contract) public {
        vaultRegistry = VaultRegistryMock(_contract);
    }

    function checkOnlyFromVault() public {
        vaultRegistry.checkOnlyFromVault();
    }

    // setter function only for test, not a real Vault function
    function setBlockController(address _contract) public {
        blockController = BlockController(_contract);
    }

    function submitDepositBlock(bytes32 _blockRoot) public {
        blockController.submitDepositBlock(_blockRoot);
    }
}
