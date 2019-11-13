# RLPReader.sol

View Source: [contracts/src/utils/RLPReader.sol](../../contracts/src/utils/RLPReader.sol)

**RLPReader**

## Structs
### RLPItem

```js
struct RLPItem {
 uint256 len,
 uint256 memPtr
}
```

## Contract Members
**Constants & Variables**

```js
uint8 internal constant STRING_SHORT_START;
uint8 internal constant STRING_LONG_START;
uint8 internal constant LIST_SHORT_START;
uint8 internal constant LIST_LONG_START;
uint8 internal constant MAX_SHORT_LEN;
uint8 internal constant WORD_SIZE;

```

## Functions

- [toRlpItem(bytes item)](#torlpitem)
- [toList(struct RLPReader.RLPItem item)](#tolist)
- [isList(struct RLPReader.RLPItem item)](#islist)
- [toRlpBytes(struct RLPReader.RLPItem item)](#torlpbytes)
- [toAddress(struct RLPReader.RLPItem item)](#toaddress)
- [toUint(struct RLPReader.RLPItem item)](#touint)
- [numItems(struct RLPReader.RLPItem item)](#numitems)
- [_itemLength(uint256 memPtr)](#_itemlength)
- [_payloadOffset(uint256 memPtr)](#_payloadoffset)
- [copy(uint256 src, uint256 dest, uint256 len)](#copy)
- [toBytes(struct RLPReader.RLPItem item)](#tobytes)

### toRlpItem

```js
function toRlpItem(bytes item) internal pure
returns(struct RLPReader.RLPItem)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | bytes |  | 

### toList

```js
function toList(struct RLPReader.RLPItem item) internal pure
returns(struct RLPReader.RLPItem[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

### isList

```js
function isList(struct RLPReader.RLPItem item) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

### toRlpBytes

```js
function toRlpBytes(struct RLPReader.RLPItem item) internal pure
returns(bytes)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

### toAddress

```js
function toAddress(struct RLPReader.RLPItem item) internal pure
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

### toUint

```js
function toUint(struct RLPReader.RLPItem item) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

### numItems

```js
function numItems(struct RLPReader.RLPItem item) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

### _itemLength

```js
function _itemLength(uint256 memPtr) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| memPtr | uint256 |  | 

### _payloadOffset

```js
function _payloadOffset(uint256 memPtr) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| memPtr | uint256 |  | 

### copy

```js
function copy(uint256 src, uint256 dest, uint256 len) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| src | uint256 |  | 
| dest | uint256 |  | 
| len | uint256 |  | 

### toBytes

```js
function toBytes(struct RLPReader.RLPItem item) internal pure
returns(bytes)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem |  | 

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
