# PaymentInFlightExitRouterArgs.sol

View Source: [contracts/src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol](../../contracts/src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol)

**PaymentInFlightExitRouterArgs**

## Structs
### StartExitArgs

```js
struct StartExitArgs {
 bytes inFlightTx,
 bytes[] inputTxs,
 uint256[] inputTxTypes,
 uint256[] inputUtxosPos,
 bytes[] outputGuardPreimagesForInputs,
 bytes[] inputTxsInclusionProofs,
 bytes[] inputTxsConfirmSigs,
 bytes[] inFlightTxWitnesses,
 bytes[] inputSpendingConditionOptionalArgs
}
```

### PiggybackInFlightExitOnInputArgs

```js
struct PiggybackInFlightExitOnInputArgs {
 bytes inFlightTx,
 uint16 inputIndex
}
```

### PiggybackInFlightExitOnOutputArgs

```js
struct PiggybackInFlightExitOnOutputArgs {
 bytes inFlightTx,
 uint16 outputIndex,
 bytes outputGuardPreimage
}
```

### ChallengeCanonicityArgs

```js
struct ChallengeCanonicityArgs {
 bytes inputTx,
 uint256 inputUtxoPos,
 bytes inFlightTx,
 uint16 inFlightTxInputIndex,
 bytes competingTx,
 uint16 competingTxInputIndex,
 bytes outputGuardPreimage,
 uint256 competingTxPos,
 bytes competingTxInclusionProof,
 bytes competingTxWitness,
 bytes competingTxConfirmSig,
 bytes competingTxSpendingConditionOptionalArgs
}
```

### ChallengeInputSpentArgs

```js
struct ChallengeInputSpentArgs {
 bytes inFlightTx,
 uint16 inFlightTxInputIndex,
 bytes challengingTx,
 uint16 challengingTxInputIndex,
 bytes challengingTxWitness,
 bytes inputTx,
 uint256 inputUtxoPos,
 bytes spendingConditionOptionalArgs
}
```

### ChallengeOutputSpent

```js
struct ChallengeOutputSpent {
 bytes inFlightTx,
 bytes inFlightTxInclusionProof,
 uint256 outputUtxoPos,
 bytes challengingTx,
 uint16 challengingTxInputIndex,
 bytes challengingTxWitness,
 bytes spendingConditionOptionalArgs
}
```

## Functions

## Contracts

* [Address](Address.md)
* [AddressPayable](AddressPayable.md)
* [Bits](Bits.md)
* [BlockController](BlockController.md)
* [BlockModel](BlockModel.md)
* [BondSize](BondSize.md)
* [ECDSA](ECDSA.md)
* [Erc20DepositVerifier](Erc20DepositVerifier.md)
* [Erc20Vault](Erc20Vault.md)
* [EthDepositVerifier](EthDepositVerifier.md)
* [EthVault](EthVault.md)
* [ExitableTimestamp](ExitableTimestamp.md)
* [ExitGameController](ExitGameController.md)
* [ExitGameRegistry](ExitGameRegistry.md)
* [ExitId](ExitId.md)
* [ExitPriority](ExitPriority.md)
* [IERC20](IERC20.md)
* [IErc20DepositVerifier](IErc20DepositVerifier.md)
* [IEthDepositVerifier](IEthDepositVerifier.md)
* [IExitProcessor](IExitProcessor.md)
* [IOutputGuardHandler](IOutputGuardHandler.md)
* [IsDeposit](IsDeposit.md)
* [ISpendingCondition](ISpendingCondition.md)
* [IStateTransitionVerifier](IStateTransitionVerifier.md)
* [ITxFinalizationVerifier](ITxFinalizationVerifier.md)
* [Math](Math.md)
* [Merkle](Merkle.md)
* [Migrations](Migrations.md)
* [OnlyFromAddress](OnlyFromAddress.md)
* [OnlyWithValue](OnlyWithValue.md)
* [Operated](Operated.md)
* [OutputGuardHandlerRegistry](OutputGuardHandlerRegistry.md)
* [OutputGuardModel](OutputGuardModel.md)
* [OutputId](OutputId.md)
* [Ownable](Ownable.md)
* [PaymentChallengeIFEInputSpent](PaymentChallengeIFEInputSpent.md)
* [PaymentChallengeIFENotCanonical](PaymentChallengeIFENotCanonical.md)
* [PaymentChallengeIFEOutputSpent](PaymentChallengeIFEOutputSpent.md)
* [PaymentChallengeStandardExit](PaymentChallengeStandardExit.md)
* [PaymentEip712Lib](PaymentEip712Lib.md)
* [PaymentExitDataModel](PaymentExitDataModel.md)
* [PaymentExitGame](PaymentExitGame.md)
* [PaymentInFlightExitModelUtils](PaymentInFlightExitModelUtils.md)
* [PaymentInFlightExitRouter](PaymentInFlightExitRouter.md)
* [PaymentInFlightExitRouterArgs](PaymentInFlightExitRouterArgs.md)
* [PaymentOutputGuardHandler](PaymentOutputGuardHandler.md)
* [PaymentOutputModel](PaymentOutputModel.md)
* [PaymentOutputToPaymentTxCondition](PaymentOutputToPaymentTxCondition.md)
* [PaymentPiggybackInFlightExit](PaymentPiggybackInFlightExit.md)
* [PaymentProcessInFlightExit](PaymentProcessInFlightExit.md)
* [PaymentProcessStandardExit](PaymentProcessStandardExit.md)
* [PaymentStandardExitRouter](PaymentStandardExitRouter.md)
* [PaymentStandardExitRouterArgs](PaymentStandardExitRouterArgs.md)
* [PaymentStartInFlightExit](PaymentStartInFlightExit.md)
* [PaymentStartStandardExit](PaymentStartStandardExit.md)
* [PaymentTransactionModel](PaymentTransactionModel.md)
* [PaymentTransactionStateTransitionVerifier](PaymentTransactionStateTransitionVerifier.md)
* [PlasmaFramework](PlasmaFramework.md)
* [PriorityQueue](PriorityQueue.md)
* [Protocol](Protocol.md)
* [Quarantine](Quarantine.md)
* [RLP](RLP.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SpendingConditionRegistry](SpendingConditionRegistry.md)
* [TxFinalizationModel](TxFinalizationModel.md)
* [TxFinalizationVerifier](TxFinalizationVerifier.md)
* [TxPosLib](TxPosLib.md)
* [UtxoPosLib](UtxoPosLib.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
* [WireTransaction](WireTransaction.md)
* [ZeroHashesProvider](ZeroHashesProvider.md)
