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
 contract OutputGuardHandlerRegistry outputGuardHandlerRegistry,
 uint256 minExitPeriod,
 uint256 ethVaultId,
 uint256 erc20VaultId
}
```

## Contract Members
**Constants & Variables**

```js
uint8 public constant MAX_INPUT_NUM;
uint8 public constant MAX_OUTPUT_NUM;

```

**Events**

```js
event InFlightExitInputPiggybacked(address indexed exitTarget, bytes32  txHash, uint16  inputIndex);
event InFlightExitOutputPiggybacked(address indexed exitTarget, bytes32  txHash, uint16  outputIndex);
```

## Functions

- [buildController(PlasmaFramework framework, IExitProcessor exitProcessor, OutputGuardHandlerRegistry outputGuardHandlerRegistry, uint256 ethVaultId, uint256 erc20VaultId)](#buildcontroller)
- [piggybackInput(struct PaymentPiggybackInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs args)](#piggybackinput)
- [piggybackOutput(struct PaymentPiggybackInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs args)](#piggybackoutput)
- [enqueue(struct PaymentPiggybackInFlightExit.Controller controller, address token, struct UtxoPosLib.UtxoPos utxoPos, uint160 exitId)](#enqueue)
- [getExitTargetOfOutput(struct PaymentPiggybackInFlightExit.Controller controller, bytes20 outputGuard, uint256 outputType, bytes outputGuardPreimage)](#getexittargetofoutput)
- [isFirstPiggybackOfTheToken(struct PaymentExitDataModel.InFlightExit ife, address token)](#isfirstpiggybackofthetoken)

### buildController

Function that builds the controller struct

```js
function buildController(PlasmaFramework framework, IExitProcessor exitProcessor, OutputGuardHandlerRegistry outputGuardHandlerRegistry, uint256 ethVaultId, uint256 erc20VaultId) public view
returns(struct PaymentPiggybackInFlightExit.Controller)
```

**Returns**

Controller struct of PaymentPiggybackInFlightExit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| exitProcessor | IExitProcessor |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
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

### getExitTargetOfOutput

```js
function getExitTargetOfOutput(struct PaymentPiggybackInFlightExit.Controller controller, bytes20 outputGuard, uint256 outputType, bytes outputGuardPreimage) private view
returns(address payable)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentPiggybackInFlightExit.Controller |  | 
| outputGuard | bytes20 |  | 
| outputType | uint256 |  | 
| outputGuardPreimage | bytes |  | 

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
