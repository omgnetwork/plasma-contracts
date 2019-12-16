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
- [toAddress(struct RLPReader.RLPItem item)](#toaddress)
- [toUint(struct RLPReader.RLPItem item)](#touint)
- [toBytes32(struct RLPReader.RLPItem item)](#tobytes32)
- [countEncodedItems(struct RLPReader.RLPItem item)](#countencodeditems)
- [decodeLengthAndOffset(uint256 memPtr)](#decodelengthandoffset)

### toRlpItem

Convert a dynamic bytes array into an RLPItem

```js
function toRlpItem(bytes item) internal pure
returns(struct RLPReader.RLPItem)
```

**Returns**

An RLPItem

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | bytes | RLP encoded bytes | 

### toList

Convert a dynamic bytes array into a list of RLPItems

```js
function toList(struct RLPReader.RLPItem item) internal pure
returns(struct RLPReader.RLPItem[])
```

**Returns**

A list of RLPItems

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem | RLP encoded list in bytes | 

### isList

Check whether the RLPItem is either a list

```js
function isList(struct RLPReader.RLPItem item) internal pure
returns(bool)
```

**Returns**

A boolean whether the RLPItem is a list

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem | RLP encoded list in bytes | 

### toAddress

Create an address from a RLPItem

```js
function toAddress(struct RLPReader.RLPItem item) internal pure
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem | RLPItem | 

### toUint

Create a uint256 from a RLPItem. Leading zeros are invalid.

```js
function toUint(struct RLPReader.RLPItem item) internal pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem | RLPItem | 

### toBytes32

Create a bytes32 from a RLPItem

```js
function toBytes32(struct RLPReader.RLPItem item) internal pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem | RLPItem | 

### countEncodedItems

Counts the number of payload items inside an RLP encoded list

```js
function countEncodedItems(struct RLPReader.RLPItem item) private pure
returns(uint256)
```

**Returns**

The number of items in a inside an RLP encoded list

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| item | struct RLPReader.RLPItem | RLPItem | 

### decodeLengthAndOffset

Decodes the RLPItem's length and offset.

```js
function decodeLengthAndOffset(uint256 memPtr) internal pure
returns(uint256, uint256)
```

**Returns**

The length of the RLPItem (including the length field) and the offset of the payload

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| memPtr | uint256 | Pointer to the dynamic bytes array in memory | 

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
