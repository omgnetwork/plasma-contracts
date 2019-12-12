# PaymentStartStandardExit.sol

View Source: [contracts/src/exits/payment/controllers/PaymentStartStandardExit.sol](../../contracts/src/exits/payment/controllers/PaymentStartStandardExit.sol)

**PaymentStartStandardExit**

## Structs
### Controller

```js
struct Controller {
 contract IExitProcessor exitProcessor,
 contract PlasmaFramework framework,
 struct ExitableTimestamp.Calculator exitableTimestampCalculator,
 uint256 ethVaultId,
 uint256 erc20VaultId,
 uint256 supportedTxType
}
```

### StartStandardExitData

```js
struct StartStandardExitData {
 struct PaymentStartStandardExit.Controller controller,
 struct PaymentStandardExitRouterArgs.StartStandardExitArgs args,
 struct UtxoPosLib.UtxoPos utxoPos,
 struct PaymentTransactionModel.Transaction outputTx,
 struct FungibleTokenOutputModel.Output output,
 uint160 exitId,
 bool isTxDeposit,
 uint256 txBlockTimeStamp,
 bytes32 outputId
}
```

**Events**

```js
event ExitStarted(address indexed owner, uint160  exitId);
```

## Functions

- [buildController(IExitProcessor exitProcessor, PlasmaFramework framework, uint256 ethVaultId, uint256 erc20VaultId, uint256 supportedTxType)](#buildcontroller)
- [run(struct PaymentStartStandardExit.Controller self, struct PaymentExitDataModel.StandardExitMap exitMap, struct PaymentStandardExitRouterArgs.StartStandardExitArgs args)](#run)
- [setupStartStandardExitData(struct PaymentStartStandardExit.Controller controller, struct PaymentStandardExitRouterArgs.StartStandardExitArgs args)](#setupstartstandardexitdata)
- [verifyStartStandardExitData(struct PaymentStartStandardExit.Controller self, struct PaymentStartStandardExit.StartStandardExitData data, struct PaymentExitDataModel.StandardExitMap exitMap)](#verifystartstandardexitdata)
- [isStandardFinalized(struct PaymentStartStandardExit.StartStandardExitData data)](#isstandardfinalized)
- [saveStandardExitData(struct PaymentStartStandardExit.StartStandardExitData data, struct PaymentExitDataModel.StandardExitMap exitMap)](#savestandardexitdata)
- [enqueueStandardExit(struct PaymentStartStandardExit.StartStandardExitData data)](#enqueuestandardexit)

### buildController

Function that builds the controller struct

```js
function buildController(IExitProcessor exitProcessor, PlasmaFramework framework, uint256 ethVaultId, uint256 erc20VaultId, uint256 supportedTxType) public view
returns(struct PaymentStartStandardExit.Controller)
```

**Returns**

Controller struct of PaymentStartStandardExit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitProcessor | IExitProcessor |  | 
| framework | PlasmaFramework |  | 
| ethVaultId | uint256 |  | 
| erc20VaultId | uint256 |  | 
| supportedTxType | uint256 |  | 

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

### isStandardFinalized

```js
function isStandardFinalized(struct PaymentStartStandardExit.StartStandardExitData data) private view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentStartStandardExit.StartStandardExitData |  | 

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
