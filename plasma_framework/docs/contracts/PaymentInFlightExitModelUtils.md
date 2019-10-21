# PaymentInFlightExitModelUtils.sol

View Source: [contracts/src/exits/payment/PaymentInFlightExitModelUtils.sol](../../contracts/src/exits/payment/PaymentInFlightExitModelUtils.sol)

**PaymentInFlightExitModelUtils**

## Contract Members
**Constants & Variables**

```js
uint8 public constant MAX_INPUT_NUM;
uint8 public constant MAX_OUTPUT_NUM;

```

## Functions

- [isInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#isinputpiggybacked)
- [isOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#isoutputpiggybacked)
- [setInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#setinputpiggybacked)
- [clearInputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#clearinputpiggybacked)
- [clearOutputPiggyback(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#clearoutputpiggyback)
- [setOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#setoutputpiggybacked)
- [clearOutputPiggybacked(struct PaymentExitDataModel.InFlightExit ife, uint16 index)](#clearoutputpiggybacked)
- [isInFirstPhase(struct PaymentExitDataModel.InFlightExit ife, uint256 minExitPeriod)](#isinfirstphase)
- [isFirstPiggybackOfTheToken(struct PaymentExitDataModel.InFlightExit ife, address token)](#isfirstpiggybackofthetoken)

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

### clearOutputPiggyback

```js
function clearOutputPiggyback(struct PaymentExitDataModel.InFlightExit ife, uint16 index) internal nonpayable
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

### isFirstPiggybackOfTheToken

```js
function isFirstPiggybackOfTheToken(struct PaymentExitDataModel.InFlightExit ife, address token) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| token | address |  | 

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
* [RLPReader](RLPReader.md)
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
