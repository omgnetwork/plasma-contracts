# PaymentTransactionStateTransitionVerifier.sol

View Source: [contracts/src/exits/payment/PaymentTransactionStateTransitionVerifier.sol](../../contracts/src/exits/payment/PaymentTransactionStateTransitionVerifier.sol)

**PaymentTransactionStateTransitionVerifier**

Verifies state transitions for payment transaction

## Functions

- [isCorrectStateTransition(bytes txBytes, bytes[] inputTxs, uint16[] outputIndexOfInputTxs)](#iscorrectstatetransition)
- [_isCorrectStateTransition(struct FungibleTokenOutputModel.Output[] inputs, struct FungibleTokenOutputModel.Output[] outputs)](#_iscorrectstatetransition)
- [filterWithToken(struct FungibleTokenOutputModel.Output[] outputs, address token)](#filterwithtoken)
- [isCorrectSpend(struct FungibleTokenOutputModel.Output[] inputs, struct FungibleTokenOutputModel.Output[] outputs)](#iscorrectspend)
- [sumAmounts(struct FungibleTokenOutputModel.Output[] outputs)](#sumamounts)

### isCorrectStateTransition

For payment transaction to be valid, the state transition should check that the sum of the inputs is larger than the sum of the outputs

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
function _isCorrectStateTransition(struct FungibleTokenOutputModel.Output[] inputs, struct FungibleTokenOutputModel.Output[] outputs) private pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputs | struct FungibleTokenOutputModel.Output[] |  | 
| outputs | struct FungibleTokenOutputModel.Output[] |  | 

### filterWithToken

```js
function filterWithToken(struct FungibleTokenOutputModel.Output[] outputs, address token) private pure
returns(struct FungibleTokenOutputModel.Output[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputs | struct FungibleTokenOutputModel.Output[] |  | 
| token | address |  | 

### isCorrectSpend

```js
function isCorrectSpend(struct FungibleTokenOutputModel.Output[] inputs, struct FungibleTokenOutputModel.Output[] outputs) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputs | struct FungibleTokenOutputModel.Output[] |  | 
| outputs | struct FungibleTokenOutputModel.Output[] |  | 

### sumAmounts

```js
function sumAmounts(struct FungibleTokenOutputModel.Output[] outputs) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputs | struct FungibleTokenOutputModel.Output[] |  | 

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
* [FungibleTokenOutputModel](FungibleTokenOutputModel.md)
* [GenericTransaction](GenericTransaction.md)
* [IERC20](IERC20.md)
* [IErc20DepositVerifier](IErc20DepositVerifier.md)
* [IEthDepositVerifier](IEthDepositVerifier.md)
* [IExitProcessor](IExitProcessor.md)
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
* [PosLib](PosLib.md)
* [PriorityQueue](PriorityQueue.md)
* [Protocol](Protocol.md)
* [Quarantine](Quarantine.md)
* [RLPReader](RLPReader.md)
* [SafeERC20](SafeERC20.md)
* [SafeEthTransfer](SafeEthTransfer.md)
* [SafeMath](SafeMath.md)
* [SpendingConditionRegistry](SpendingConditionRegistry.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
