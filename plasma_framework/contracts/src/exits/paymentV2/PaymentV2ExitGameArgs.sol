pragma solidity 0.5.11;

import "../registries/SpendingConditionRegistry.sol";
import "../interfaces/IStateTransitionVerifier.sol";
import "../../framework/PlasmaFramework.sol";

library PaymentV2ExitGameArgs {
    /**
     * @param framework The Plasma framework
     * @param ethVaultId Vault id for EthVault
     * @param erc20VaultId Vault id for the Erc20Vault
     * @param spendingConditionRegistry the spendingConditionRegistry that can provide spending condition implementation by types
     * @param stateTransitionVerifier state transition verifier predicate contract that checks the transaction correctness
     * @param supportTxType the tx type of this exit game is using
     * @param safeGasStipend a gas amount limit when transferring Eth to protect from attack with draining gas
     */
    struct Args {
        PlasmaFramework framework;
        uint256 ethVaultId;
        uint256 erc20VaultId;
        SpendingConditionRegistry spendingConditionRegistry;
        IStateTransitionVerifier stateTransitionVerifier;
        uint256 supportTxType;
        uint256 safeGasStipend;
    }
}
