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
 struct FungibleTokenOutputModel.Output[] outputs,
 uint256 txData,
 bytes32 metaData
}
```

## Contract Members
**Constants & Variables**

```js
uint8 private constant _MAX_INPUT_NUM;
uint8 private constant _MAX_OUTPUT_NUM;
uint8 private constant ENCODED_LENGTH;

```

## Functions

- [MAX_INPUT_NUM()](#max_input_num)
- [MAX_OUTPUT_NUM()](#max_output_num)
- [decode(bytes _tx)](#decode)
- [fromGeneric(struct GenericTransaction.Transaction genericTx)](#fromgeneric)
- [getOutputOwner(struct FungibleTokenOutputModel.Output output)](#getoutputowner)

### MAX_INPUT_NUM

```js
function MAX_INPUT_NUM() internal pure
returns(uint8)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### MAX_OUTPUT_NUM

```js
function MAX_OUTPUT_NUM() internal pure
returns(uint8)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### decode

Decodes a encoded byte array into a PaymentTransaction
The following rules about the rlp-encoded transaction are enforced:
     - `txType` must be an integer value with no leading zeros
     - `inputs` is an list of 0 to 4 elements
     - Each `input` is a 32 byte long array
     - An `input` may not be all zeros
     - `outputs` is an list of 0 to 4 elements
     - Each `output` is a list of 2 elements: [`outputType`, `data`]
     - `output.outputType` must be an integer value with no leading zeros
     - See FungibleTokenOutputModel for deatils on `output.data` encoding.
     - An `output` may not be null; A null output is one whose amount is zero

```js
function decode(bytes _tx) internal pure
returns(struct PaymentTransactionModel.Transaction)
```

**Returns**

A decoded PaymentTransaction struct

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tx | bytes | An RLP-encoded transaction | 

### fromGeneric

Converts a GenericTransaction to a PaymentTransaction

```js
function fromGeneric(struct GenericTransaction.Transaction genericTx) internal pure
returns(struct PaymentTransactionModel.Transaction)
```

**Returns**

A PaymentTransaction.Transaction struct

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| genericTx | struct GenericTransaction.Transaction | A GenericTransaction.Transaction struct | 

### getOutputOwner

Retrieve the 'owner' from the output, assuming the
        'outputGuard' field directly holds the owner's address

```js
function getOutputOwner(struct FungibleTokenOutputModel.Output output) internal pure
returns(address payable)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| output | struct FungibleTokenOutputModel.Output |  | 

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
