# PaymentInFlightExitRouterArgs.sol

View Source: [contracts/src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol](../../contracts/src/exits/payment/routers/PaymentInFlightExitRouterArgs.sol)

**PaymentInFlightExitRouterArgs**

## Structs
### StartExitArgs

```js
struct StartExitArgs {
 bytes inFlightTx,
 bytes[] inputTxs,
 uint256[] inputUtxosPos,
 bytes[] inputTxsInclusionProofs,
 bytes[] inFlightTxWitnesses
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
 uint16 outputIndex
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
 uint256 competingTxPos,
 bytes competingTxInclusionProof,
 bytes competingTxWitness
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
 uint256 inputUtxoPos
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
 bytes challengingTxWitness
}
```

## Functions

## Contracts

* [Address](Address.md)
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
* [FailFastReentrancyGuard](FailFastReentrancyGuard.md)
* [GenericTransaction](GenericTransaction.md)
* [IERC20](IERC20.md)
* [IErc20DepositVerifier](IErc20DepositVerifier.md)
* [IEthDepositVerifier](IEthDepositVerifier.md)
* [IExitProcessor](IExitProcessor.md)
* [IsDeposit](IsDeposit.md)
* [ISpendingCondition](ISpendingCondition.md)
* [IStateTransitionVerifier](IStateTransitionVerifier.md)
* [Math](Math.md)
* [Merkle](Merkle.md)
* [Migrations](Migrations.md)
* [MoreVpFinalization](MoreVpFinalization.md)
* [OnlyFromAddress](OnlyFromAddress.md)
* [OnlyWithValue](OnlyWithValue.md)
* [OutputId](OutputId.md)
* [Ownable](Ownable.md)
* [PaymentChallengeIFEInputSpent](PaymentChallengeIFEInputSpent.md)
* [PaymentChallengeIFENotCanonical](PaymentChallengeIFENotCanonical.md)
* [PaymentChallengeIFEOutputSpent](PaymentChallengeIFEOutputSpent.md)
* [PaymentChallengeStandardExit](PaymentChallengeStandardExit.md)
* [PaymentDeleteInFlightExit](PaymentDeleteInFlightExit.md)
* [PaymentEip712Lib](PaymentEip712Lib.md)
* [PaymentExitDataModel](PaymentExitDataModel.md)
* [PaymentExitGame](PaymentExitGame.md)
* [PaymentExitGameArgs](PaymentExitGameArgs.md)
* [PaymentInFlightExitModelUtils](PaymentInFlightExitModelUtils.md)
* [PaymentInFlightExitRouter](PaymentInFlightExitRouter.md)
* [PaymentInFlightExitRouterArgs](PaymentInFlightExitRouterArgs.md)
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
* [RLPReader](RLPReader.md)
* [SafeERC20](SafeERC20.md)
* [SafeEthTransfer](SafeEthTransfer.md)
* [SafeMath](SafeMath.md)
* [SpendingConditionRegistry](SpendingConditionRegistry.md)
* [TxPosLib](TxPosLib.md)
* [UtxoPosLib](UtxoPosLib.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
