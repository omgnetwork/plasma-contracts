# PosLib.sol

View Source: [contracts/src/utils/PosLib.sol](../../contracts/src/utils/PosLib.sol)

**PosLib**

UTXO position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex).
TX position = (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET)

## Structs
### Position

```js
struct Position {
 uint256 blockNum,
 uint256 txIndex,
 uint16 outputIndex
}
```

## Contract Members
**Constants & Variables**

```js
uint256 internal constant BLOCK_OFFSET;
uint256 internal constant TX_OFFSET;

```

## Functions

- [toStrictTxPos(struct PosLib.Position pos)](#tostricttxpos)
- [getTxPostionForExitPriority(struct PosLib.Position pos)](#gettxpostionforexitpriority)
- [encode(struct PosLib.Position pos)](#encode)
- [decode(uint256 pos)](#decode)

### toStrictTxPos

Returns transaction position which is an utxo position of zero index output

```js
function toStrictTxPos(struct PosLib.Position pos) internal pure
returns(struct PosLib.Position)
```

**Returns**

Position of a transaction

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pos | struct PosLib.Position | UTXO position of the output | 

### getTxPostionForExitPriority

Used for calculating exit priority

```js
function getTxPostionForExitPriority(struct PosLib.Position pos) internal pure
returns(uint256)
```

**Returns**

Identifier of the transaction

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pos | struct PosLib.Position | UTXO position for the output | 

### encode

Encodes a position

```js
function encode(struct PosLib.Position pos) internal pure
returns(uint256)
```

**Returns**

Position encoded as an integer

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pos | struct PosLib.Position | Position | 

### decode

Decodes a position from an integer value

```js
function decode(uint256 pos) internal pure
returns(struct PosLib.Position)
```

**Returns**

Position

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pos | uint256 | Encoded position | 

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
* [WireTransaction](WireTransaction.md)
