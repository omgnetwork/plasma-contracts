# PaymentChallengeStandardExit.sol

View Source: [contracts/src/exits/payment/controllers/PaymentChallengeStandardExit.sol](../../contracts/src/exits/payment/controllers/PaymentChallengeStandardExit.sol)

**PaymentChallengeStandardExit**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 struct IsDeposit.Predicate isDeposit,
 contract SpendingConditionRegistry spendingConditionRegistry,
 contract OutputGuardHandlerRegistry outputGuardHandlerRegistry,
 contract ITxFinalizationVerifier txFinalizationVerifier
}
```

### ChallengeStandardExitData

```js
struct ChallengeStandardExitData {
 struct PaymentChallengeStandardExit.Controller controller,
 struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args,
 struct PaymentExitDataModel.StandardExit exitData
}
```

**Events**

```js
event ExitChallenged(uint256 indexed utxoPos);
```

## Functions

- [buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, OutputGuardHandlerRegistry outputGuardHandlerRegistry, ITxFinalizationVerifier txFinalizationVerifier)](#buildcontroller)
- [run(struct PaymentChallengeStandardExit.Controller self, struct PaymentExitDataModel.StandardExitMap exitMap, struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args)](#run)
- [verifyChallengeExitExists(struct PaymentChallengeStandardExit.ChallengeStandardExitData data)](#verifychallengeexitexists)
- [verifyChallengeTxProtocolFinalized(struct PaymentChallengeStandardExit.ChallengeStandardExitData data)](#verifychallengetxprotocolfinalized)
- [verifySpendingCondition(struct PaymentChallengeStandardExit.ChallengeStandardExitData data)](#verifyspendingcondition)

### buildController

Function that builds the controller struct

```js
function buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, OutputGuardHandlerRegistry outputGuardHandlerRegistry, ITxFinalizationVerifier txFinalizationVerifier) public view
returns(struct PaymentChallengeStandardExit.Controller)
```

**Returns**

Controller struct of PaymentChallengeStandardExit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| spendingConditionRegistry | SpendingConditionRegistry |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
| txFinalizationVerifier | ITxFinalizationVerifier |  | 

### run

Main logic function to challenge standard exit

```js
function run(struct PaymentChallengeStandardExit.Controller self, struct PaymentExitDataModel.StandardExitMap exitMap, struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentChallengeStandardExit.Controller | The controller struct | 
| exitMap | struct PaymentExitDataModel.StandardExitMap | The storage of all standard exit data | 
| args | struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs | Arguments of challenge standard exit function from client | 

### verifyChallengeExitExists

```js
function verifyChallengeExitExists(struct PaymentChallengeStandardExit.ChallengeStandardExitData data) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentChallengeStandardExit.ChallengeStandardExitData |  | 

### verifyChallengeTxProtocolFinalized

```js
function verifyChallengeTxProtocolFinalized(struct PaymentChallengeStandardExit.ChallengeStandardExitData data) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentChallengeStandardExit.ChallengeStandardExitData |  | 

### verifySpendingCondition

```js
function verifySpendingCondition(struct PaymentChallengeStandardExit.ChallengeStandardExitData data) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentChallengeStandardExit.ChallengeStandardExitData |  | 

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
