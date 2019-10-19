# RLP (RLP.sol)

View Source: [contracts/src/utils/RLP.sol](../../contracts/src/utils/RLP.sol)

**RLP**

Library for RLP decoding.
Based off of https://github.com/androlo/standard-contracts/blob/master/contracts/src/codec/RLP.sol.

## Structs
### RLPItem

```js
struct RLPItem {
 uint256 _unsafeMemPtr,
 uint256 _unsafeLength
}
```

### Iterator

```js
struct Iterator {
 struct RLP.RLPItem _unsafeItem,
 uint256 _unsafeNextPtr
}
```

## Contract Members
**Constants & Variables**

```js
uint256 internal constant DATA_SHORT_START;
uint256 internal constant DATA_LONG_START;
uint256 internal constant LIST_SHORT_START;
uint256 internal constant LIST_LONG_START;
uint256 internal constant DATA_LONG_OFFSET;
uint256 internal constant LIST_LONG_OFFSET;

```

## Functions

- [toRLPItem(bytes self)](#torlpitem)
- [toRLPItem(bytes self, bool strict)](#torlpitem)
- [isNull(struct RLP.RLPItem self)](#isnull)
- [isList(struct RLP.RLPItem self)](#islist)
- [isData(struct RLP.RLPItem self)](#isdata)
- [isEmpty(struct RLP.RLPItem self)](#isempty)
- [items(struct RLP.RLPItem self)](#items)
- [iterator(struct RLP.RLPItem self)](#iterator)
- [toData(struct RLP.RLPItem self)](#todata)
- [toList(struct RLP.RLPItem self)](#tolist)
- [toAscii(struct RLP.RLPItem self)](#toascii)
- [toUint(struct RLP.RLPItem self)](#touint)
- [toBool(struct RLP.RLPItem self)](#tobool)
- [toByte(struct RLP.RLPItem self)](#tobyte)
- [toInt(struct RLP.RLPItem self)](#toint)
- [toBytes32(struct RLP.RLPItem self)](#tobytes32)
- [toAddress(struct RLP.RLPItem self)](#toaddress)
- [toBytes20(struct RLP.RLPItem self)](#tobytes20)
- [_next(struct RLP.Iterator self)](#_next)
- [_next(struct RLP.Iterator self, bool strict)](#_next)
- [_hasNext(struct RLP.Iterator self)](#_hasnext)
- [_payloadOffset(struct RLP.RLPItem self)](#_payloadoffset)
- [_itemLength(uint256 memPtr)](#_itemlength)
- [_decode(struct RLP.RLPItem self)](#_decode)
- [_copyToBytes(uint256 btsPtr, bytes tgt, uint256 btsLen)](#_copytobytes)
- [_validate(struct RLP.RLPItem self)](#_validate)

### toRLPItem

Creates an RLPItem from an array of RLP encoded bytes.

```js
function toRLPItem(bytes self) internal pure
returns(struct RLP.RLPItem)
```

**Returns**

An RLPItem.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | bytes | The RLP encoded bytes. | 

### toRLPItem

Creates an RLPItem from an array of RLP encoded bytes.

```js
function toRLPItem(bytes self, bool strict) internal pure
returns(struct RLP.RLPItem)
```

**Returns**

An RLPItem

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | bytes | The RLP encoded bytes. | 
| strict | bool | Will throw if the data is not RLP encoded. | 

### isNull

Check if the RLP item is null.

```js
function isNull(struct RLP.RLPItem self) internal pure
returns(ret bool)
```

**Returns**

'true' if the item is null.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### isList

Check if the RLP item is a list.

```js
function isList(struct RLP.RLPItem self) internal pure
returns(ret bool)
```

**Returns**

'true' if the item is a list.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### isData

Check if the RLP item is data.

```js
function isData(struct RLP.RLPItem self) internal pure
returns(ret bool)
```

**Returns**

'true' if the item is data.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### isEmpty

Check if the RLP item is empty (string or list).

```js
function isEmpty(struct RLP.RLPItem self) internal pure
returns(ret bool)
```

**Returns**

'true' if the item is null.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### items

Get the number of items in an RLP encoded list.

```js
function items(struct RLP.RLPItem self) internal pure
returns(uint256)
```

**Returns**

The number of items.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### iterator

Create an iterator.

```js
function iterator(struct RLP.RLPItem self) internal pure
returns(it struct RLP.Iterator)
```

**Returns**

An 'Iterator' over the item.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### toData

Decode an RLPItem into bytes. This will not work if the RLPItem is a list.

```js
function toData(struct RLP.RLPItem self) internal pure
returns(bts bytes)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toList

Get the list of sub-items from an RLP encoded list.
Warning: This is inefficient, as it requires that the list is read twice.

```js
function toList(struct RLP.RLPItem self) internal pure
returns(list struct RLP.RLPItem[])
```

**Returns**

Array of RLPItems.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLP item. | 

### toAscii

Decode an RLPItem into an ascii string. This will not work if the RLPItem is a list.

```js
function toAscii(struct RLP.RLPItem self) internal pure
returns(str string)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toUint

Decode an RLPItem into a uint. This will not work if the RLPItem is a list.

```js
function toUint(struct RLP.RLPItem self) internal pure
returns(data uint256)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toBool

Decode an RLPItem into a boolean. This will not work if the RLPItem is a list.

```js
function toBool(struct RLP.RLPItem self) internal pure
returns(data bool)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toByte

Decode an RLPItem into a byte. This will not work if the RLPItem is a list.

```js
function toByte(struct RLP.RLPItem self) internal pure
returns(data bytes1)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toInt

Decode an RLPItem into an int. This will not work if the RLPItem is a list.

```js
function toInt(struct RLP.RLPItem self) internal pure
returns(data int256)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toBytes32

Decode an RLPItem into a bytes32. This will not work if the RLPItem is a list.

```js
function toBytes32(struct RLP.RLPItem self) internal pure
returns(data bytes32)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toAddress

Decode an RLPItem into an address. This will not work if the RLPItem is a list.

```js
function toAddress(struct RLP.RLPItem self) internal pure
returns(data address)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### toBytes20

Decode an RLPItem into a bytes20. This will not work if the RLPItem is a list.

```js
function toBytes20(struct RLP.RLPItem self) internal pure
returns(data bytes20)
```

**Returns**

The decoded string.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | The RLPItem. | 

### _next

Returns the next RLP item for some iterator.

```js
function _next(struct RLP.Iterator self) private pure
returns(subItem struct RLP.RLPItem)
```

**Returns**

The next RLP item.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.Iterator | The iterator. | 

### _next

Returns the next RLP item for some iterator and validates it.

```js
function _next(struct RLP.Iterator self, bool strict) private pure
returns(subItem struct RLP.RLPItem)
```

**Returns**

The next RLP item.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.Iterator | The iterator. | 
| strict | bool |  | 

### _hasNext

Checks if an iterator has a next RLP item.

```js
function _hasNext(struct RLP.Iterator self) private pure
returns(bool)
```

**Returns**

True if the iterator has an RLP item. False otherwise.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.Iterator | The iterator. | 

### _payloadOffset

Determines the payload offset of some RLP item.

```js
function _payloadOffset(struct RLP.RLPItem self) private pure
returns(uint256)
```

**Returns**

The payload offset for that item.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | RLP item to query. | 

### _itemLength

Determines the length of an RLP item.

```js
function _itemLength(uint256 memPtr) private pure
returns(len uint256)
```

**Returns**

Length of the item.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| memPtr | uint256 | Pointer to the start of the item. | 

### _decode

Determines the start position and length of some RLP item.

```js
function _decode(struct RLP.RLPItem self) private pure
returns(memPtr uint256, len uint256)
```

**Returns**

A pointer to the beginning of the item and the length of that item.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | RLP item to query. | 

### _copyToBytes

Copies some data to a certain target.

```js
function _copyToBytes(uint256 btsPtr, bytes tgt, uint256 btsLen) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| btsPtr | uint256 | Pointer to the data to copy. | 
| tgt | bytes | Place to copy. | 
| btsLen | uint256 | How many bytes to copy. | 

### _validate

Checks that an RLP item is valid.

```js
function _validate(struct RLP.RLPItem self) private pure
returns(ret bool)
```

**Returns**

True if the RLP item is well-formed. False otherwise.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct RLP.RLPItem | RLP item to validate. | 

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
