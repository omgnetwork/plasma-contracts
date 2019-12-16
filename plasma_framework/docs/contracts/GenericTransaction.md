# GenericTransaction (GenericTransaction.sol)

View Source: [contracts/src/transactions/GenericTransaction.sol](../../contracts/src/transactions/GenericTransaction.sol)

**GenericTransaction**

GenericTransaction is a generic transaction format that makes few assumptions about the
content of the transaction. A transaction must satisy the following requirements:
- It must be a list of 5 items: [txType, inputs, outputs, txData, metaData]
- `txType` must be a uint not equal to zero
- inputs must be a list of RLP items.
- outputs must be a list of `Output`s
- an `Output` is a list of 2 items: [outputType, data]
- `Output.outputType` must be a uint not equal to zero
- `Output.data` is an RLP item. It can be a list.
- no assumptions are made about `txData`. Note that `txData` can be a list.
- `metaData` must be 32 bytes long.

## Structs
### Transaction

```js
struct Transaction {
 uint256 txType,
 struct RLPReader.RLPItem[] inputs,
 struct GenericTransaction.Output[] outputs,
 struct RLPReader.RLPItem txData,
 bytes32 metaData
}
```

### Output

```js
struct Output {
 uint256 outputType,
 struct RLPReader.RLPItem data
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
- [decodeOutput(struct RLPReader.RLPItem encodedOutput)](#decodeoutput)

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

```js
function decodeOutput(struct RLPReader.RLPItem encodedOutput) internal pure
returns(struct GenericTransaction.Output)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| encodedOutput | struct RLPReader.RLPItem |  | 

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
