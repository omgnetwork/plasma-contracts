# PaymentOutputToPaymentTxCondition.sol

View Source: [contracts/src/exits/payment/spendingConditions/PaymentOutputToPaymentTxCondition.sol](../contracts/src/exits/payment/spendingConditions/PaymentOutputToPaymentTxCondition.sol)

**↗ Extends: [ISpendingCondition](ISpendingCondition.md)**

**PaymentOutputToPaymentTxCondition**

## Contract Members
**Constants & Variables**

```js
uint256 internal supportInputTxType;
uint256 internal supportSpendingTxType;
struct PaymentEip712Lib.Constants internal eip712;

```

## Functions

- [(address framework, uint256 inputTxType, uint256 spendingTxType)](#)
- [verify(bytes inputTxBytes, uint16 outputIndex, uint256 inputTxPos, bytes spendingTxBytes, uint16 inputIndex, bytes signature, bytes )](#verify)

### 

This is designed to be re-useable for all versions of Payment transaction.
     As a result, inputTxType and spendingTxType of the Payment output is injected instead.

```js
function (address framework, uint256 inputTxType, uint256 spendingTxType) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | address |  | 
| inputTxType | uint256 |  | 
| spendingTxType | uint256 |  | 

### verify

⤾ overrides [ISpendingCondition.verify](ISpendingCondition.md#verify)

Verifies the spending condition

```js
function verify(bytes inputTxBytes, uint16 outputIndex, uint256 inputTxPos, bytes spendingTxBytes, uint16 inputIndex, bytes signature, bytes ) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputTxBytes | bytes | encoded input transaction in bytes | 
| outputIndex | uint16 | the output index of the input transaction | 
| inputTxPos | uint256 | the tx position of the input tx. (0 if in-flight) | 
| spendingTxBytes | bytes | spending transaction in bytes | 
| inputIndex | uint16 | the input index of the spending tx that points to the output | 
| signature | bytes | signature of the output owner | 
|  | bytes | inputTxBytes encoded input transaction in bytes | 

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
* [GracefulReentrancyGuard](GracefulReentrancyGuard.md)
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
* [ReentrancyGuard](ReentrancyGuard.md)
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
