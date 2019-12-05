# PaymentTransactionModel.sol

View Source: [contracts/src/transactions/PaymentTransactionModel.sol](../../contracts/src/transactions/PaymentTransactionModel.sol)

**PaymentTransactionModel**

Data structure and its decode function for Payment transaction

## Structs
### Transaction

```js
struct Transaction {
 uint256 txType,
 bytes32[] inputs,
 struct GenericTransaction.Output[] outputs,
 bytes32 metaData
}
```

## Contract Members
**Constants & Variables**

```js
uint8 public constant MAX_INPUT_NUM;
uint8 public constant MAX_OUTPUT_NUM;

```

## Functions

- [decode(bytes _tx)](#decode)
- [fromGeneric(struct GenericTransaction.Transaction btx)](#fromgeneric)
- [decodeOutput(struct RLPReader.RLPItem output)](#decodeoutput)
- [getOutputOwner(struct GenericTransaction.Output _output)](#getoutputowner)

### decode

```js
function decode(bytes _tx) internal pure
returns(struct PaymentTransactionModel.Transaction)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tx | bytes |  | 

### fromGeneric

```js
function fromGeneric(struct GenericTransaction.Transaction btx) internal pure
returns(struct PaymentTransactionModel.Transaction)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| btx | struct GenericTransaction.Transaction |  | 

### decodeOutput

```js
function decodeOutput(struct RLPReader.RLPItem output) internal pure
returns(struct GenericTransaction.Output)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| output | struct RLPReader.RLPItem |  | 

### getOutputOwner

Retrieve the 'owner' from the output, assuming the
        'outputGuard' field directly holds the owner's address

```js
function getOutputOwner(struct GenericTransaction.Output _output) internal pure
returns(address payable)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _output | struct GenericTransaction.Output |  | 

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
