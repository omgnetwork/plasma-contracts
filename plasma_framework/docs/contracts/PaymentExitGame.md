# PaymentExitGame.sol

View Source: [contracts/src/exits/payment/PaymentExitGame.sol](../../contracts/src/exits/payment/PaymentExitGame.sol)

**↗ Extends: [IExitProcessor](IExitProcessor.md), [PaymentStandardExitRouter](PaymentStandardExitRouter.md), [PaymentInFlightExitRouter](PaymentInFlightExitRouter.md), [OnlyFromAddress](OnlyFromAddress.md)**

**PaymentExitGame**

The exit game contract implementation for Payment Transaction

## Contract Members
**Constants & Variables**

```js
contract PlasmaFramework private plasmaFramework;

```

## Functions

- [(PlasmaFramework framework, uint256 ethVaultId, uint256 erc20VaultId, OutputGuardHandlerRegistry outputGuardHandlerRegistry, SpendingConditionRegistry spendingConditionRegistry, IStateTransitionVerifier stateTransitionVerifier, ITxFinalizationVerifier txFinalizationVerifier, uint256 supportTxType)](#)
- [processExit(uint160 exitId, uint256 , address token)](#processexit)
- [getStandardExitId(bool _isDeposit, bytes _txBytes, uint256 _utxoPos)](#getstandardexitid)
- [getInFlightExitId(bytes _txBytes)](#getinflightexitid)

### 

```js
function (PlasmaFramework framework, uint256 ethVaultId, uint256 erc20VaultId, OutputGuardHandlerRegistry outputGuardHandlerRegistry, SpendingConditionRegistry spendingConditionRegistry, IStateTransitionVerifier stateTransitionVerifier, ITxFinalizationVerifier txFinalizationVerifier, uint256 supportTxType) public nonpayable PaymentStandardExitRouter PaymentInFlightExitRouter 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| ethVaultId | uint256 |  | 
| erc20VaultId | uint256 |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
| spendingConditionRegistry | SpendingConditionRegistry |  | 
| stateTransitionVerifier | IStateTransitionVerifier |  | 
| txFinalizationVerifier | ITxFinalizationVerifier |  | 
| supportTxType | uint256 |  | 

### processExit

⤾ overrides [IExitProcessor.processExit](IExitProcessor.md#processexit)

Callback processes exit function for the PlasmaFramework to call.

```js
function processExit(uint160 exitId, uint256 , address token) external nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint160 | exit id. | 
|  | uint256 | exitId exit id. | 
| token | address | token (ERC20 address or address(0) for ETH) of the exiting output. | 

### getStandardExitId

Helper function to compute standard exit id.

```js
function getStandardExitId(bool _isDeposit, bytes _txBytes, uint256 _utxoPos) public pure
returns(uint192)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _isDeposit | bool |  | 
| _txBytes | bytes |  | 
| _utxoPos | uint256 |  | 

### getInFlightExitId

Helper function to compute in-flight exit id.

```js
function getInFlightExitId(bytes _txBytes) public pure
returns(uint192)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txBytes | bytes |  | 

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
* [Operated](Operated.md)
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
