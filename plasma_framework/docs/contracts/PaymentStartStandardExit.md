# PaymentStartStandardExit.sol

View Source: [contracts/src/exits/payment/controllers/PaymentStartStandardExit.sol](../../contracts/src/exits/payment/controllers/PaymentStartStandardExit.sol)

**PaymentStartStandardExit**

## Structs
### Controller

```js
struct Controller {
 contract IExitProcessor exitProcessor,
 contract PlasmaFramework framework,
 struct IsDeposit.Predicate isDeposit,
 struct ExitableTimestamp.Calculator exitableTimestampCalculator,
 contract OutputGuardHandlerRegistry outputGuardHandlerRegistry,
 contract ITxFinalizationVerifier txFinalizationVerifier,
 uint256 ethVaultId,
 uint256 erc20VaultId
}
```

### StartStandardExitData

```js
struct StartStandardExitData {
 struct PaymentStartStandardExit.Controller controller,
 struct PaymentStandardExitRouterArgs.StartStandardExitArgs args,
 struct UtxoPosLib.UtxoPos utxoPos,
 struct PaymentTransactionModel.Transaction outputTx,
 struct PaymentOutputModel.Output output,
 contract IOutputGuardHandler outputGuardHandler,
 struct OutputGuardModel.Data outputGuardData,
 uint160 exitId,
 bool isTxDeposit,
 uint256 txBlockTimeStamp,
 bytes32 outputId,
 struct TxFinalizationModel.Data finalizationData
}
```

**Events**

```js
event ExitStarted(address indexed owner, uint160  exitId);
```

## Functions

- [buildController(IExitProcessor exitProcessor, PlasmaFramework framework, OutputGuardHandlerRegistry outputGuardHandlerRegistry, ITxFinalizationVerifier txFinalizationVerifier, uint256 ethVaultId, uint256 erc20VaultId)](#buildcontroller)
- [run(struct PaymentStartStandardExit.Controller self, struct PaymentExitDataModel.StandardExitMap exitMap, struct PaymentStandardExitRouterArgs.StartStandardExitArgs args)](#run)
- [setupStartStandardExitData(struct PaymentStartStandardExit.Controller controller, struct PaymentStandardExitRouterArgs.StartStandardExitArgs args)](#setupstartstandardexitdata)
- [verifyStartStandardExitData(struct PaymentStartStandardExit.Controller self, struct PaymentStartStandardExit.StartStandardExitData data, struct PaymentExitDataModel.StandardExitMap exitMap)](#verifystartstandardexitdata)
- [saveStandardExitData(struct PaymentStartStandardExit.StartStandardExitData data, struct PaymentExitDataModel.StandardExitMap exitMap)](#savestandardexitdata)
- [enqueueStandardExit(struct PaymentStartStandardExit.StartStandardExitData data)](#enqueuestandardexit)

### buildController

Function that builds the controller struct

```js
function buildController(IExitProcessor exitProcessor, PlasmaFramework framework, OutputGuardHandlerRegistry outputGuardHandlerRegistry, ITxFinalizationVerifier txFinalizationVerifier, uint256 ethVaultId, uint256 erc20VaultId) public view
returns(struct PaymentStartStandardExit.Controller)
```

**Returns**

Controller struct of PaymentStartStandardExit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitProcessor | IExitProcessor |  | 
| framework | PlasmaFramework |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
| txFinalizationVerifier | ITxFinalizationVerifier |  | 
| ethVaultId | uint256 |  | 
| erc20VaultId | uint256 |  | 

### run

Main logic function to start standard exit

```js
function run(struct PaymentStartStandardExit.Controller self, struct PaymentExitDataModel.StandardExitMap exitMap, struct PaymentStandardExitRouterArgs.StartStandardExitArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentStartStandardExit.Controller | The controller struct | 
| exitMap | struct PaymentExitDataModel.StandardExitMap | The storage of all standard exit data | 
| args | struct PaymentStandardExitRouterArgs.StartStandardExitArgs | Arguments of start standard exit function from client | 

### setupStartStandardExitData

```js
function setupStartStandardExitData(struct PaymentStartStandardExit.Controller controller, struct PaymentStandardExitRouterArgs.StartStandardExitArgs args) private view
returns(struct PaymentStartStandardExit.StartStandardExitData)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentStartStandardExit.Controller |  | 
| args | struct PaymentStandardExitRouterArgs.StartStandardExitArgs |  | 

### verifyStartStandardExitData

```js
function verifyStartStandardExitData(struct PaymentStartStandardExit.Controller self, struct PaymentStartStandardExit.StartStandardExitData data, struct PaymentExitDataModel.StandardExitMap exitMap) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentStartStandardExit.Controller |  | 
| data | struct PaymentStartStandardExit.StartStandardExitData |  | 
| exitMap | struct PaymentExitDataModel.StandardExitMap |  | 

### saveStandardExitData

```js
function saveStandardExitData(struct PaymentStartStandardExit.StartStandardExitData data, struct PaymentExitDataModel.StandardExitMap exitMap) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentStartStandardExit.StartStandardExitData |  | 
| exitMap | struct PaymentExitDataModel.StandardExitMap |  | 

### enqueueStandardExit

```js
function enqueueStandardExit(struct PaymentStartStandardExit.StartStandardExitData data) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentStartStandardExit.StartStandardExitData |  | 

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
