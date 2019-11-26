# PaymentEip712Lib (PaymentEip712Lib.sol)

View Source: [contracts/src/transactions/eip712Libs/PaymentEip712Lib.sol](../../contracts/src/transactions/eip712Libs/PaymentEip712Lib.sol)

**PaymentEip712Lib**

Utilities for hashing structural data for PaymentTransaction (see EIP-712)
 *

## Structs
### Constants

```js
struct Constants {
 bytes32 DOMAIN_SEPARATOR
}
```

## Contract Members
**Constants & Variables**

```js
//public members
uint8 public constant MAX_INPUT_NUM;
uint8 public constant MAX_OUTPUT_NUM;

//internal members
bytes2 internal constant EIP191_PREFIX;
bytes32 internal constant EIP712_DOMAIN_HASH;
bytes32 internal constant TX_TYPE_HASH;
bytes32 internal constant INPUT_TYPE_HASH;
bytes32 internal constant OUTPUT_TYPE_HASH;
bytes32 internal constant SALT;
bytes32 internal constant EMPTY_INPUT_HASH;
bytes32 internal constant EMPTY_OUTPUT_HASH;

```

## Functions

- [initConstants(address _verifyingContract)](#initconstants)
- [hashTx(struct PaymentEip712Lib.Constants _eip712, struct PaymentTransactionModel.Transaction _tx)](#hashtx)
- [_hashTx(struct PaymentTransactionModel.Transaction _tx)](#_hashtx)
- [_hashInput(bytes32 _input)](#_hashinput)
- [_hashOutput(struct PaymentOutputModel.Output _output)](#_hashoutput)

### initConstants

```js
function initConstants(address _verifyingContract) internal pure
returns(struct PaymentEip712Lib.Constants)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _verifyingContract | address |  | 

### hashTx

```js
function hashTx(struct PaymentEip712Lib.Constants _eip712, struct PaymentTransactionModel.Transaction _tx) internal pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _eip712 | struct PaymentEip712Lib.Constants |  | 
| _tx | struct PaymentTransactionModel.Transaction |  | 

### _hashTx

```js
function _hashTx(struct PaymentTransactionModel.Transaction _tx) private pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tx | struct PaymentTransactionModel.Transaction |  | 

### _hashInput

```js
function _hashInput(bytes32 _input) private pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _input | bytes32 |  | 

### _hashOutput

```js
function _hashOutput(struct PaymentOutputModel.Output _output) private pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _output | struct PaymentOutputModel.Output |  | 

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
* [PaymentDeleteInFlightExit](PaymentDeleteInFlightExit.md)
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
* [SafeEthTransfer](SafeEthTransfer.md)
* [SafeMath](SafeMath.md)
* [SpendingConditionRegistry](SpendingConditionRegistry.md)
* [TxFinalizationModel](TxFinalizationModel.md)
* [TxFinalizationVerifier](TxFinalizationVerifier.md)
* [TxPosLib](TxPosLib.md)
* [UtxoPosLib](UtxoPosLib.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
* [WireTransaction](WireTransaction.md)
