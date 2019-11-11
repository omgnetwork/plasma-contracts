# PaymentChallengeIFEOutputSpent.sol

View Source: [contracts/src/exits/payment/controllers/PaymentChallengeIFEOutputSpent.sol](../../contracts/src/exits/payment/controllers/PaymentChallengeIFEOutputSpent.sol)

**PaymentChallengeIFEOutputSpent**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 contract SpendingConditionRegistry spendingConditionRegistry,
 contract OutputGuardHandlerRegistry outputGuardHandlerRegistry,
 contract ITxFinalizationVerifier txFinalizationVerifier,
 uint256 safeGasStipend
}
```

**Events**

```js
event InFlightExitOutputBlocked(address indexed challenger, bytes32  ifeTxHash, uint16  outputIndex);
```

## Functions

- [run(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#run)
- [verifyInFlightTransactionStandardFinalized(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#verifyinflighttransactionstandardfinalized)
- [verifyChallengingTransactionSpendsOutput(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#verifychallengingtransactionspendsoutput)

### run

Main logic implementation for 'challengeInFlightExitOutputSpent'

```js
function run(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentChallengeIFEOutputSpent.Controller | The controller struct | 
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| args | struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent | Arguments of 'challengeInFlightExitOutputSpent' function from client | 

### verifyInFlightTransactionStandardFinalized

```js
function verifyInFlightTransactionStandardFinalized(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentChallengeIFEOutputSpent.Controller |  | 
| args | struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent |  | 

### verifyChallengingTransactionSpendsOutput

```js
function verifyChallengingTransactionSpendsOutput(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| controller | struct PaymentChallengeIFEOutputSpent.Controller |  | 
| args | struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent |  | 

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
* [ZeroHashesProvider](ZeroHashesProvider.md)
