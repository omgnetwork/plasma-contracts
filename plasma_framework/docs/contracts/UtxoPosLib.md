# UtxoPosLib.sol

View Source: [contracts/src/utils/UtxoPosLib.sol](../../contracts/src/utils/UtxoPosLib.sol)

**UtxoPosLib**

UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).

## Structs
### UtxoPos

```js
struct UtxoPos {
 uint256 value
}
```

## Contract Members
**Constants & Variables**

```js
uint256 internal constant BLOCK_OFFSET;
uint256 internal constant TX_OFFSET;

```

## Functions

- [build(uint256 txPos, uint16 outputIndex)](#build)
- [blockNum(struct UtxoPosLib.UtxoPos _utxoPos)](#blocknum)
- [txIndex(struct UtxoPosLib.UtxoPos _utxoPos)](#txindex)
- [outputIndex(struct UtxoPosLib.UtxoPos _utxoPos)](#outputindex)
- [txPos(struct UtxoPosLib.UtxoPos _utxoPos)](#txpos)
- [getTxPostionForExitPriority(struct UtxoPosLib.UtxoPos _utxoPos)](#gettxpostionforexitpriority)

### build

Returns the UTXO struct for a given txPos and outputIndex

```js
function build(uint256 txPos, uint16 outputIndex) internal pure
returns(struct UtxoPosLib.UtxoPos)
```

**Returns**

UtxoPos of the relevant value

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| txPos | uint256 | Transaction position - utxo of zero index output | 
| outputIndex | uint16 | Transaction index of the output | 

### blockNum

Returns the block number of a given UTXO position

```js
function blockNum(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint256)
```

**Returns**

The block number of the output

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | UTXO position identifier for the output | 

### txIndex

Returns the transaction index of a given UTXO position

```js
function txIndex(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint256)
```

**Returns**

Transaction index of the output

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | UTXO position identifier for the output | 

### outputIndex

Returns the output index of a given UTXO position

```js
function outputIndex(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint16)
```

**Returns**

Index of the output

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | UTXO position identifier for the output | 

### txPos

Returns transaction position which is a utxo position of zero index output

```js
function txPos(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(struct UtxoPosLib.UtxoPos)
```

**Returns**

Identifier of the transaction

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | UTXO position identifier for the output | 

### getTxPostionForExitPriority

Used for calculating exit priority

```js
function getTxPostionForExitPriority(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint256)
```

**Returns**

Identifier of the transaction

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | UTXO position identifier for the output | 

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
* [SafeEthTransfer](SafeEthTransfer.md)
* [SafeMath](SafeMath.md)
* [SpendingConditionRegistry](SpendingConditionRegistry.md)
* [UtxoPosLib](UtxoPosLib.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
* [WireTransaction](WireTransaction.md)
