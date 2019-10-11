# BondSize.sol

View Source: [contracts/src/exits/utils/BondSize.sol](../contracts/src/exits/utils/BondSize.sol)

**BondSize**

Stores an updateable bond size.

## Structs
### Params

```js
struct Params {
 uint128 previousBondSize,
 uint128 updatedBondSize,
 uint128 effectiveUpdateTime,
 uint16 lowerBoundDivisor,
 uint16 upperBoundMultiplier
}
```

## Contract Members
**Constants & Variables**

```js
uint64 public constant WAITING_PERIOD;

```

## Functions

- [buildParams(uint128 initialBondSize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier)](#buildparams)
- [updateBondSize(struct BondSize.Params self, uint128 newBondSize)](#updatebondsize)
- [bondSize(struct BondSize.Params self)](#bondsize)
- [validateBondSize(struct BondSize.Params self, uint128 newBondSize)](#validatebondsize)

### buildParams

```js
function buildParams(uint128 initialBondSize, uint16 lowerBoundDivisor, uint16 upperBoundMultiplier) internal pure
returns(struct BondSize.Params)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| initialBondSize | uint128 |  | 
| lowerBoundDivisor | uint16 |  | 
| upperBoundMultiplier | uint16 |  | 

### updateBondSize

Updates the bond size.

```js
function updateBondSize(struct BondSize.Params self, uint128 newBondSize) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct BondSize.Params |  | 
| newBondSize | uint128 | the new bond size. | 

### bondSize

Returns the current bond size.

```js
function bondSize(struct BondSize.Params self) internal view
returns(uint128)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct BondSize.Params |  | 

### validateBondSize

```js
function validateBondSize(struct BondSize.Params self, uint128 newBondSize) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct BondSize.Params |  | 
| newBondSize | uint128 |  | 

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
