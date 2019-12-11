# PaymentChallengeIFEInputSpent.sol

View Source: [contracts/src/exits/payment/controllers/PaymentChallengeIFEInputSpent.sol](../../contracts/src/exits/payment/controllers/PaymentChallengeIFEInputSpent.sol)

**PaymentChallengeIFEInputSpent**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 struct IsDeposit.Predicate isDeposit,
 contract SpendingConditionRegistry spendingConditionRegistry,
 uint256 safeGasStipend
}
```

### ChallengeIFEData

```js
struct ChallengeIFEData {
 struct PaymentChallengeIFEInputSpent.Controller controller,
 struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args,
 struct PaymentExitDataModel.InFlightExit ife
}
```

**Events**

```js
event InFlightExitInputBlocked(address indexed challenger, bytes32 indexed txHash, uint16  inputIndex);
```

## Functions

- [buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, uint256 safeGasStipend)](#buildcontroller)
- [run(struct PaymentChallengeIFEInputSpent.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args)](#run)
- [verifySpentInputEqualsIFEInput(struct PaymentChallengeIFEInputSpent.ChallengeIFEData data)](#verifyspentinputequalsifeinput)
- [verifyChallengingTransactionProtocolFinalized(struct PaymentChallengeIFEInputSpent.ChallengeIFEData data)](#verifychallengingtransactionprotocolfinalized)
- [verifySpendingCondition(struct PaymentChallengeIFEInputSpent.ChallengeIFEData data)](#verifyspendingcondition)

### buildController

Function that builds the controller struct

```js
function buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, uint256 safeGasStipend) public view
returns(struct PaymentChallengeIFEInputSpent.Controller)
```

**Returns**

Controller struct of PaymentChallengeIFEInputSpent

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| spendingConditionRegistry | SpendingConditionRegistry |  | 
| safeGasStipend | uint256 |  | 

### run

Main logic implementation for 'challengeInFlightExitInputSpent'

```js
function run(struct PaymentChallengeIFEInputSpent.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentChallengeIFEInputSpent.Controller | The controller struct | 
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| args | struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs | Arguments of 'challengeInFlightExitInputSpent' function from client | 

### verifySpentInputEqualsIFEInput

```js
function verifySpentInputEqualsIFEInput(struct PaymentChallengeIFEInputSpent.ChallengeIFEData data) private pure
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentChallengeIFEInputSpent.ChallengeIFEData |  | 

### verifyChallengingTransactionProtocolFinalized

```js
function verifyChallengingTransactionProtocolFinalized(struct PaymentChallengeIFEInputSpent.ChallengeIFEData data) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentChallengeIFEInputSpent.ChallengeIFEData |  | 

### verifySpendingCondition

```js
function verifySpendingCondition(struct PaymentChallengeIFEInputSpent.ChallengeIFEData data) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| data | struct PaymentChallengeIFEInputSpent.ChallengeIFEData |  | 

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
* [WireTransaction](WireTransaction.md)
