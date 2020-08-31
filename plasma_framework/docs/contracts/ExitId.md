# ExitId.sol

View Source: [contracts/src/exits/utils/ExitId.sol](../../contracts/src/exits/utils/ExitId.sol)

**ExitId**

## Contract Members
**Constants & Variables**

```js
uint8 private constant FIRST_BIT_LOCATION;

```

## Functions

- [isStandardExit(uint168 exitId)](#isstandardexit)
- [getStandardExitId(bool isDeposit, bytes txBytes, struct PosLib.Position utxoPos)](#getstandardexitid)
- [getInFlightExitId(bytes txBytes)](#getinflightexitid)

### isStandardExit

Checks whether exitId is a standard exit ID

```js
function isStandardExit(uint168 exitId) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint168 |  | 

### getStandardExitId

Given transaction bytes and UTXO position, returns its exit ID

```js
function getStandardExitId(bool isDeposit, bytes txBytes, struct PosLib.Position utxoPos) internal pure
returns(uint168)
```

**Returns**

standardExitId Unique ID of the standard exit
    Anatomy of returned value, most significant bits first:
    1-bit - in-flight flag (0 for standard exit)
    167-bits - outputId

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| isDeposit | bool | Defines whether the tx for the exitId is a deposit tx | 
| txBytes | bytes | Transaction bytes | 
| utxoPos | struct PosLib.Position | UTXO position of the exiting output | 

### getInFlightExitId

Given transaction bytes, returns in-flight exit ID

```js
function getInFlightExitId(bytes txBytes) internal pure
returns(uint168)
```

**Returns**

Unique in-flight exit ID

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| txBytes | bytes | Transaction bytes | 

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
* [ExitBounty](ExitBounty.md)
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
