pragma solidity 0.5.11;

import "../registries/OutputGuardHandlerRegistry.sol";
import "../registries/SpendingConditionRegistry.sol";
import "../interfaces/IStateTransitionVerifier.sol";
import "../interfaces/ITxFinalizationVerifier.sol";
import "../../framework/PlasmaFramework.sol";

library PaymentExitGameArgs {
    /**
     * @param framework The Plasma framework
     * @param ethVaultId Vault id for EthVault
     * @param erc20VaultId Vault id for the Erc20Vault
     * @param outputGuardHandlerRegistry the outputGuardHandlerRegistry that can provide outputGuardHandler implementation by types
     * @param spendingConditionRegistry the spendingConditionRegistry that can provide spending condition implementation by types
     * @param stateTransitionVerifier state transition verifier predicate contract that checks the transaction correctness
     * @param txFinalizationVerifier util contract that checks tx is finalized or not
     * @param supportTxType the tx type of this exit game is using
     * @param safeGasStipend a gas amount limit when tranferring Eth to protect from attack with draining gas
     */
    struct Args {
        PlasmaFramework framework;
        uint256 ethVaultId;
        uint256 erc20VaultId;
        OutputGuardHandlerRegistry outputGuardHandlerRegistry;
        SpendingConditionRegistry spendingConditionRegistry;
        IStateTransitionVerifier stateTransitionVerifier;
        ITxFinalizationVerifier txFinalizationVerifier;
        uint256 supportTxType;
        uint256 safeGasStipend;
    }
}
