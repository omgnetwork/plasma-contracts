pragma solidity 0.5.11;

import "./registries/VaultRegistryMock.sol";
import "../../src/framework/BlockController.sol";

contract DummyVault {
    VaultRegistryMock internal vaultRegistry;
    BlockController internal blockController;

    // setter function only for test, not a real Vault function
    function setVaultRegistry(address _contract) public {
        vaultRegistry = VaultRegistryMock(_contract);
    }

    function checkOnlyFromNonQuarantinedVault() public view returns (bool) {
        return vaultRegistry.checkOnlyFromNonQuarantinedVault();
    }

    // setter function only for test, not a real Vault function
    function setBlockController(address _contract) public {
        blockController = BlockController(_contract);
    }

    function submitDepositBlock(bytes32 _blockRoot) public {
        blockController.submitDepositBlock(_blockRoot);
    }
}
