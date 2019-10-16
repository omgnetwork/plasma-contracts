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

- [build(struct TxPosLib.TxPos txPos, uint16 outputIndex)](#build)
- [blockNum(struct UtxoPosLib.UtxoPos _utxoPos)](#blocknum)
- [txIndex(struct UtxoPosLib.UtxoPos _utxoPos)](#txindex)
- [outputIndex(struct UtxoPosLib.UtxoPos _utxoPos)](#outputindex)
- [txPos(struct UtxoPosLib.UtxoPos _utxoPos)](#txpos)

### build

Given txPos and outputIndex, returns the Utxo struct.

```js
function build(struct TxPosLib.TxPos txPos, uint16 outputIndex) internal pure
returns(struct UtxoPosLib.UtxoPos)
```

**Returns**

UtxoPos of the according value

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| txPos | struct TxPosLib.TxPos | tx position | 
| outputIndex | uint16 | the output's transaction index. | 

### blockNum

Given an UTXO position, returns the block number.

```js
function blockNum(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint256)
```

**Returns**

The output's block number.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | Output identifier in form of utxo position. | 

### txIndex

Given an UTXO position, returns the transaction index.

```js
function txIndex(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint256)
```

**Returns**

The output's transaction index.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | Output identifier in form of utxo position. | 

### outputIndex

Given an UTXO position, returns the output index.

```js
function outputIndex(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint16)
```

**Returns**

The output's index.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | Output identifier in form of utxo position. | 

### txPos

Given an UTXO position, returns transaction position.

```js
function txPos(struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(struct TxPosLib.TxPos)
```

**Returns**

The transaction position.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _utxoPos | struct UtxoPosLib.UtxoPos | Output identifier in form of utxo position. | 

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
