# GenericTransaction (GenericTransaction.sol)

View Source: [contracts/src/transactions/GenericTransaction.sol](../../contracts/src/transactions/GenericTransaction.sol)

**GenericTransaction**

GenericTransaction is a generic transaction format that makes few assumptions about the
content of the transaction. At minimum a transaction must:
- Be a list of 4 items: [txType, inputs, outputs, txData]
- `txType` must be a uint not equal to zero
- inputs must be a list
- outputs must be a list
- no assumptions are made about `txData`. Note that `txData` can be a list.
 * It is expected that most transaction types will have similar outputs, so convenience methods for
decoding outputs are provided. However, transactions types are free to extend this output format
with extra data.

## Structs
### Transaction

```js
struct Transaction {
 uint256 txType,
 struct RLPReader.RLPItem[] inputs,
 struct RLPReader.RLPItem[] outputs,
 struct RLPReader.RLPItem txData
}
```

### Output

```js
struct Output {
 uint256 outputType,
 bytes20 outputGuard,
 address token,
 uint256 amount
}
```

## Contract Members
**Constants & Variables**

```js
uint8 private constant TX_NUM_ITEMS;

```

## Functions

- [decode(bytes transaction)](#decode)
- [getOutput(struct GenericTransaction.Transaction transaction, uint16 outputIndex)](#getoutput)
- [decodeOutput(struct RLPReader.RLPItem[] outputRlpList)](#decodeoutput)

### decode

Decodes an RLP encoded transaction into the generic format.

```js
function decode(bytes transaction) internal pure
returns(struct GenericTransaction.Transaction)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| transaction | bytes |  | 

### getOutput

Returns the output at a specific index in the transaction

```js
function getOutput(struct GenericTransaction.Transaction transaction, uint16 outputIndex) internal pure
returns(struct GenericTransaction.Output)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| transaction | struct GenericTransaction.Transaction |  | 
| outputIndex | uint16 |  | 

### decodeOutput

Decodes an RLPItem to an output
Each Output is a list with (at least) the following first four elements: outputType, outputGuard, token, amount

```js
function decodeOutput(struct RLPReader.RLPItem[] outputRlpList) internal pure
returns(struct GenericTransaction.Output)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputRlpList | struct RLPReader.RLPItem[] |  | 

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
* [GenericTransaction](GenericTransaction.md)
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
* [TxPosLib](TxPosLib.md)
* [UtxoPosLib](UtxoPosLib.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
