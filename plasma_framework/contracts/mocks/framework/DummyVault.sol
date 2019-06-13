pragma solidity ^0.5.0;

import "./registries/VaultRegistryMock.sol";
import "../../src/framework/BlockController.sol";

contract DummyVault {
    VaultRegistryMock vaultRegistry;
    BlockController blockController;

    function setVaultRegistry(address _contract) public {
        vaultRegistry = VaultRegistryMock(_contract);
    }

    function checkOnlyFromVault() public {
        vaultRegistry.checkOnlyFromVault();
    }

    function setBlockController(address _contract) public {
        blockController = BlockController(_contract);
    }

    function submitDepositBlock(bytes32 _blockRoot) public {
        blockController.submitDepositBlock(_blockRoot);
    }
}
