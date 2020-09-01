# PaymentInFlightExitModelUtils.sol

View Source: [contracts/src/exits/payment/PaymentInFlightExitModelUtils.sol](../../contracts/src/exits/payment/PaymentInFlightExitModelUtils.sol)

**PaymentInFlightExitModelUtils**

## Functions

- [isInputEmpty(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#isinputempty)
- [isOutputEmpty(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#isoutputempty)
- [isInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#isinputpiggybacked)
- [isOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#isoutputpiggybacked)
- [setInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#setinputpiggybacked)
- [clearInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#clearinputpiggybacked)
- [setOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#setoutputpiggybacked)
- [clearOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#clearoutputpiggybacked)
- [isInFirstPhase(struct PaymentExitDataModel.InFlightExit ife, uint256 minExitPeriod)](#isinfirstphase)
- [isEmptyWithdrawData(struct PaymentExitDataModel.WithdrawData data)](#isemptywithdrawdata)

### isInputEmpty

```js
function isInputEmpty(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### isOutputEmpty

```js
function isOutputEmpty(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### isInputPiggybacked

```js
function isInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### isOutputPiggybacked

```js
function isOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### setInputPiggybacked

```js
function setInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### clearInputPiggybacked

```js
function clearInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### setOutputPiggybacked

```js
function setOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### clearOutputPiggybacked

```js
function clearOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| index | uint16 |  | 

### isInFirstPhase

```js
function isInFirstPhase(struct PaymentExitDataModel.InFlightExit ife, uint256 minExitPeriod) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| minExitPeriod | uint256 |  | 

### isEmptyWithdrawData

```js
function isEmptyWithdrawData(struct PaymentExitDataModel.WithdrawData data) private pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentExitDataModel.WithdrawData |  | 

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
* [ExitBounty](ExitBounty.md)
* [ExitGameController](ExitGameController.md)
* [ExitGameRegistry](ExitGameRegistry.md)
* [ExitId](ExitId.md)
* [ExitPriority](ExitPriority.md)
* [FailFastReentrancyGuard](FailFastReentrancyGuard.md)
* [FeeClaimOutputToPaymentTxCondition](FeeClaimOutputToPaymentTxCondition.md)
* [FeeExitGame](FeeExitGame.md)
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
