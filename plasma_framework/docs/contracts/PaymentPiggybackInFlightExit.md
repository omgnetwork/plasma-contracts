# PaymentPiggybackInFlightExit.sol

View Source: [contracts/src/exits/payment/controllers/PaymentPiggybackInFlightExit.sol](../../contracts/src/exits/payment/controllers/PaymentPiggybackInFlightExit.sol)

**PaymentPiggybackInFlightExit**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 struct IsDeposit.Predicate isDeposit,
 struct ExitableTimestamp.Calculator exitableTimestampCalculator,
 contract IExitProcessor exitProcessor,
 uint256 minExitPeriod,
 uint256 ethVaultId,
 uint256 erc20VaultId
}
```

**Events**

```js
event InFlightExitInputPiggybacked(address indexed exitTarget, bytes32 indexed txHash, uint16  inputIndex);
event InFlightExitOutputPiggybacked(address indexed exitTarget, bytes32 indexed txHash, uint16  outputIndex);
```

## Functions

- [buildController(PlasmaFramework framework, IExitProcessor exitProcessor, uint256 ethVaultId, uint256 erc20VaultId)](#buildcontroller)
- [piggybackInput(struct PaymentPiggybackInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs args)](#piggybackinput)
- [piggybackOutput(struct PaymentPiggybackInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs args)](#piggybackoutput)
- [enqueue(struct PaymentPiggybackInFlightExit.Controller controller, address token, struct UtxoPosLib.UtxoPos utxoPos, uint160 exitId)](#enqueue)
- [isFirstPiggybackOfTheToken(struct PaymentExitDataModel.InFlightExit ife, address token)](#isfirstpiggybackofthetoken)

### buildController

Function that builds the controller struct

```js
function buildController(PlasmaFramework framework, IExitProcessor exitProcessor, uint256 ethVaultId, uint256 erc20VaultId) public view
returns(struct PaymentPiggybackInFlightExit.Controller)
```

**Returns**

Controller struct of PaymentPiggybackInFlightExit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| exitProcessor | IExitProcessor |  | 
| ethVaultId | uint256 |  | 
| erc20VaultId | uint256 |  | 

### piggybackInput

The main controller logic for 'piggybackInFlightExitOnInput'

```js
function piggybackInput(struct PaymentPiggybackInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentPiggybackInFlightExit.Controller | The controller struct | 
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| args | struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs | Arguments of 'piggybackInFlightExitOnInput' function from client | 

### piggybackOutput

The main controller logic for 'piggybackInFlightExitOnOutput'

```js
function piggybackOutput(struct PaymentPiggybackInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentPiggybackInFlightExit.Controller | The controller struct | 
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| args | struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs | Arguments of 'piggybackInFlightExitOnOutput' function from client | 

### enqueue

```js
function enqueue(struct PaymentPiggybackInFlightExit.Controller controller, address token, struct UtxoPosLib.UtxoPos utxoPos, uint160 exitId) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentPiggybackInFlightExit.Controller |  | 
| token | address |  | 
| utxoPos | struct UtxoPosLib.UtxoPos |  | 
| exitId | uint160 |  | 

### isFirstPiggybackOfTheToken

```js
function isFirstPiggybackOfTheToken(struct PaymentExitDataModel.InFlightExit ife, address token) private pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  | 
| token | address |  | 

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
