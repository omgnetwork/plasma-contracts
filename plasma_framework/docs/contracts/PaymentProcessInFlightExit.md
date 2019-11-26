# PaymentProcessInFlightExit.sol

View Source: [contracts/src/exits/payment/controllers/PaymentProcessInFlightExit.sol](../../contracts/src/exits/payment/controllers/PaymentProcessInFlightExit.sol)

**PaymentProcessInFlightExit**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 contract EthVault ethVault,
 contract Erc20Vault erc20Vault,
 uint256 safeGasStipend
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
event InFlightExitOmitted(uint160 indexed exitId, address  token);
event InFlightExitOutputWithdrawn(uint160 indexed exitId, uint16  outputIndex);
event InFlightExitInputWithdrawn(uint160 indexed exitId, uint16  inputIndex);
event InFlightBondReturnFailed(address indexed receiver, uint256  amount);
```

## Functions

- [run(struct PaymentProcessInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap exitMap, uint160 exitId, address token)](#run)
- [isAnyInputSpent(PlasmaFramework framework, struct PaymentExitDataModel.InFlightExit exit, address token)](#isanyinputspent)
- [shouldWithdrawInput(struct PaymentExitDataModel.InFlightExit exit, struct PaymentExitDataModel.WithdrawData withdrawal, address token, uint16 index)](#shouldwithdrawinput)
- [shouldWithdrawOutput(struct PaymentProcessInFlightExit.Controller controller, struct PaymentExitDataModel.InFlightExit exit, struct PaymentExitDataModel.WithdrawData withdrawal, address token, uint16 index)](#shouldwithdrawoutput)
- [withdrawFromVault(struct PaymentProcessInFlightExit.Controller self, struct PaymentExitDataModel.WithdrawData withdrawal)](#withdrawfromvault)
- [flagInputsAndOutputsSpent(PlasmaFramework framework, struct PaymentExitDataModel.InFlightExit exit, address token)](#flaginputsandoutputsspent)
- [clearPiggybackInputFlag(struct PaymentExitDataModel.InFlightExit exit, address token)](#clearpiggybackinputflag)
- [clearPiggybackOutputFlag(struct PaymentExitDataModel.InFlightExit exit, address token)](#clearpiggybackoutputflag)
- [allPiggybacksCleared(struct PaymentExitDataModel.InFlightExit exit)](#allpiggybackscleared)

### run

Main logic function to process in-flight exit

```js
function run(struct PaymentProcessInFlightExit.Controller self, struct PaymentExitDataModel.InFlightExitMap exitMap, uint160 exitId, address token) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentProcessInFlightExit.Controller | The controller struct | 
| exitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| exitId | uint160 | The exitId of the in-flight exit | 
| token | address | The ERC20 token address of the exit; uses address(0) to represent ETH | 

### isAnyInputSpent

```js
function isAnyInputSpent(PlasmaFramework framework, struct PaymentExitDataModel.InFlightExit exit, address token) private view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| exit | struct PaymentExitDataModel.InFlightExit |  | 
| token | address |  | 

### shouldWithdrawInput

```js
function shouldWithdrawInput(struct PaymentExitDataModel.InFlightExit exit, struct PaymentExitDataModel.WithdrawData withdrawal, address token, uint16 index) private pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exit | struct PaymentExitDataModel.InFlightExit |  | 
| withdrawal | struct PaymentExitDataModel.WithdrawData |  | 
| token | address |  | 
| index | uint16 |  | 

### shouldWithdrawOutput

```js
function shouldWithdrawOutput(struct PaymentProcessInFlightExit.Controller controller, struct PaymentExitDataModel.InFlightExit exit, struct PaymentExitDataModel.WithdrawData withdrawal, address token, uint16 index) private view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentProcessInFlightExit.Controller |  | 
| exit | struct PaymentExitDataModel.InFlightExit |  | 
| withdrawal | struct PaymentExitDataModel.WithdrawData |  | 
| token | address |  | 
| index | uint16 |  | 

### withdrawFromVault

```js
function withdrawFromVault(struct PaymentProcessInFlightExit.Controller self, struct PaymentExitDataModel.WithdrawData withdrawal) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentProcessInFlightExit.Controller |  | 
| withdrawal | struct PaymentExitDataModel.WithdrawData |  | 

### flagInputsAndOutputsSpent

```js
function flagInputsAndOutputsSpent(PlasmaFramework framework, struct PaymentExitDataModel.InFlightExit exit, address token) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| exit | struct PaymentExitDataModel.InFlightExit |  | 
| token | address |  | 

### clearPiggybackInputFlag

```js
function clearPiggybackInputFlag(struct PaymentExitDataModel.InFlightExit exit, address token) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exit | struct PaymentExitDataModel.InFlightExit |  | 
| token | address |  | 

### clearPiggybackOutputFlag

```js
function clearPiggybackOutputFlag(struct PaymentExitDataModel.InFlightExit exit, address token) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exit | struct PaymentExitDataModel.InFlightExit |  | 
| token | address |  | 

### allPiggybacksCleared

```js
function allPiggybacksCleared(struct PaymentExitDataModel.InFlightExit exit) private pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exit | struct PaymentExitDataModel.InFlightExit |  | 

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
* [PaymentDeleteInFlightExit](PaymentDeleteInFlightExit.md)
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
