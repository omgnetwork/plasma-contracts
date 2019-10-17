# PaymentTransactionStateTransitionVerifier.sol

View Source: [contracts/src/exits/payment/PaymentTransactionStateTransitionVerifier.sol](../../contracts/src/exits/payment/PaymentTransactionStateTransitionVerifier.sol)

**PaymentTransactionStateTransitionVerifier**

Verifies state transitions for payment transaction

## Functions

- [isCorrectStateTransition(bytes txBytes, bytes[] inputTxs, uint16[] outputIndexOfInputTxs)](#iscorrectstatetransition)
- [_isCorrectStateTransition(struct WireTransaction.Output[] inputs, struct WireTransaction.Output[] outputs)](#_iscorrectstatetransition)
- [filterWithToken(struct WireTransaction.Output[] outputs, address token)](#filterwithtoken)
- [isCorrectSpend(struct WireTransaction.Output[] inputs, struct WireTransaction.Output[] outputs)](#iscorrectspend)
- [sumAmounts(struct WireTransaction.Output[] outputs)](#sumamounts)

### isCorrectStateTransition

For Payment transaction to be valid, the state transition should check that the sum of the inputs is larger than the sum of the outputs

```js
function isCorrectStateTransition(bytes txBytes, bytes[] inputTxs, uint16[] outputIndexOfInputTxs) external pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| txBytes | bytes |  | 
| inputTxs | bytes[] |  | 
| outputIndexOfInputTxs | uint16[] |  | 

### _isCorrectStateTransition

```js
function _isCorrectStateTransition(struct WireTransaction.Output[] inputs, struct WireTransaction.Output[] outputs) private pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputs | struct WireTransaction.Output[] |  | 
| outputs | struct WireTransaction.Output[] |  | 

### filterWithToken

```js
function filterWithToken(struct WireTransaction.Output[] outputs, address token) private pure
returns(struct WireTransaction.Output[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputs | struct WireTransaction.Output[] |  | 
| token | address |  | 

### isCorrectSpend

```js
function isCorrectSpend(struct WireTransaction.Output[] inputs, struct WireTransaction.Output[] outputs) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputs | struct WireTransaction.Output[] |  | 
| outputs | struct WireTransaction.Output[] |  | 

### sumAmounts

```js
function sumAmounts(struct WireTransaction.Output[] outputs) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputs | struct WireTransaction.Output[] |  | 

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
* [FailFastReentrancyGuard](FailFastReentrancyGuard.md)
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
