# PaymentStartInFlightExit.sol

View Source: [contracts/src/exits/payment/controllers/PaymentStartInFlightExit.sol](../../contracts/src/exits/payment/controllers/PaymentStartInFlightExit.sol)

**PaymentStartInFlightExit**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 struct ExitableTimestamp.Calculator exitTimestampCalculator,
 contract SpendingConditionRegistry spendingConditionRegistry,
 contract IStateTransitionVerifier transitionVerifier,
 uint256 supportedTxType
}
```

### StartExitData

```js
struct StartExitData {
 struct PaymentStartInFlightExit.Controller controller,
 uint168 exitId,
 bytes inFlightTxRaw,
 struct PaymentTransactionModel.Transaction inFlightTx,
 bytes32 inFlightTxHash,
 bytes[] inputTxs,
 struct PosLib.Position[] inputUtxosPos,
 bytes[] inputTxsInclusionProofs,
 bytes[] inFlightTxWitnesses,
 bytes32[] outputIds
}
```

**Events**

```js
event InFlightExitStarted(address indexed initiator, bytes32 indexed txHash, bytes  inFlightTx, uint256[]  inputUtxosPos, bytes[]  inFlightTxWitnesses, bytes[] inputTxs);
```

## Functions

- [buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, IStateTransitionVerifier transitionVerifier, uint256 supportedTxType)](#buildcontroller)
- [run(struct PaymentStartInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.StartExitArgs args)](#run)
- [createStartExitData(struct PaymentStartInFlightExit.Controller controller, struct PaymentInFlightExitRouterArgs.StartExitArgs args)](#createstartexitdata)
- [decodeInputTxsPositions(uint256[] inputUtxosPos)](#decodeinputtxspositions)
- [getOutputIds(struct PaymentStartInFlightExit.Controller controller, bytes[] inputTxs, struct PosLib.Position[] utxoPos)](#getoutputids)
- [verifyStart(struct PaymentStartInFlightExit.StartExitData exitData, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap)](#verifystart)
- [verifyExitNotStarted(uint168 exitId, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap)](#verifyexitnotstarted)
- [verifyInFlightTxType(struct PaymentStartInFlightExit.StartExitData exitData)](#verifyinflighttxtype)
- [verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(struct PaymentStartInFlightExit.StartExitData exitData)](#verifynumberofinputsmatchesnumberofinflighttransactioninputs)
- [verifyNoInputSpentMoreThanOnce(struct PaymentTransactionModel.Transaction inFlightTx)](#verifynoinputspentmorethanonce)
- [verifyInputTransactionIsStandardFinalized(struct PaymentStartInFlightExit.StartExitData exitData)](#verifyinputtransactionisstandardfinalized)
- [verifyInputsSpent(struct PaymentStartInFlightExit.StartExitData exitData)](#verifyinputsspent)
- [verifyStateTransition(struct PaymentStartInFlightExit.StartExitData exitData)](#verifystatetransition)
- [startExit(struct PaymentStartInFlightExit.StartExitData startExitData, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap)](#startexit)
- [getYoungestInputUtxoPosition(struct PosLib.Position[] inputUtxosPos)](#getyoungestinpututxoposition)
- [setInFlightExitInputs(struct PaymentExitDataModel.InFlightExit ife, struct PaymentStartInFlightExit.StartExitData exitData)](#setinflightexitinputs)
- [setInFlightExitOutputs(struct PaymentExitDataModel.InFlightExit ife, struct PaymentStartInFlightExit.StartExitData exitData)](#setinflightexitoutputs)

### buildController

Function that builds the controller struct

```js
function buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, IStateTransitionVerifier transitionVerifier, uint256 supportedTxType) public view
returns(struct PaymentStartInFlightExit.Controller)
```

**Returns**

Controller struct of PaymentStartInFlightExit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  |
| spendingConditionRegistry | SpendingConditionRegistry |  |
| transitionVerifier | IStateTransitionVerifier |  |
| supportedTxType | uint256 |  |

### run

Main logic function to start in-flight exit

```js
function run(struct PaymentStartInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.StartExitArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentStartInFlightExit.Controller | The controller struct |
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data |
| args | struct PaymentInFlightExitRouterArgs.StartExitArgs | Arguments of start in-flight exit function from client |

### createStartExitData

```js
function createStartExitData(struct PaymentStartInFlightExit.Controller controller, struct PaymentInFlightExitRouterArgs.StartExitArgs args) private view
returns(struct PaymentStartInFlightExit.StartExitData)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentStartInFlightExit.Controller |  |
| args | struct PaymentInFlightExitRouterArgs.StartExitArgs |  |

### decodeInputTxsPositions

```js
function decodeInputTxsPositions(uint256[] inputUtxosPos) private pure
returns(struct PosLib.Position[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputUtxosPos | uint256[] |  |

### getOutputIds

```js
function getOutputIds(struct PaymentStartInFlightExit.Controller controller, bytes[] inputTxs, struct PosLib.Position[] utxoPos) private view
returns(bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentStartInFlightExit.Controller |  |
| inputTxs | bytes[] |  |
| utxoPos | struct PosLib.Position[] |  |

### verifyStart

```js
function verifyStart(struct PaymentStartInFlightExit.StartExitData exitData, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitData | struct PaymentStartInFlightExit.StartExitData |  |
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap |  |

### verifyExitNotStarted

```js
function verifyExitNotStarted(uint168 exitId, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint168 |  |
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap |  |

### verifyInFlightTxType

```js
function verifyInFlightTxType(struct PaymentStartInFlightExit.StartExitData exitData) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

### verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs

```js
function verifyNumberOfInputsMatchesNumberOfInFlightTransactionInputs(struct PaymentStartInFlightExit.StartExitData exitData) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

### verifyNoInputSpentMoreThanOnce

```js
function verifyNoInputSpentMoreThanOnce(struct PaymentTransactionModel.Transaction inFlightTx) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inFlightTx | struct PaymentTransactionModel.Transaction |  |

### verifyInputTransactionIsStandardFinalized

```js
function verifyInputTransactionIsStandardFinalized(struct PaymentStartInFlightExit.StartExitData exitData) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

### verifyInputsSpent

```js
function verifyInputsSpent(struct PaymentStartInFlightExit.StartExitData exitData) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

### verifyStateTransition

```js
function verifyStateTransition(struct PaymentStartInFlightExit.StartExitData exitData) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

### startExit

```js
function startExit(struct PaymentStartInFlightExit.StartExitData startExitData, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| startExitData | struct PaymentStartInFlightExit.StartExitData |  |
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap |  |

### getYoungestInputUtxoPosition

```js
function getYoungestInputUtxoPosition(struct PosLib.Position[] inputUtxosPos) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inputUtxosPos | struct PosLib.Position[] |  |

### setInFlightExitInputs

```js
function setInFlightExitInputs(struct PaymentExitDataModel.InFlightExit ife, struct PaymentStartInFlightExit.StartExitData exitData) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  |
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

### setInFlightExitOutputs

```js
function setInFlightExitOutputs(struct PaymentExitDataModel.InFlightExit ife, struct PaymentStartInFlightExit.StartExitData exitData) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| ife | struct PaymentExitDataModel.InFlightExit |  |
| exitData | struct PaymentStartInFlightExit.StartExitData |  |

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
