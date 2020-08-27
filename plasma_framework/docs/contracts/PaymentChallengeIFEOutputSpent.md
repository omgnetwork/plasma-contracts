# PaymentChallengeIFEOutputSpent.sol

View Source: [contracts/src/exits/payment/controllers/PaymentChallengeIFEOutputSpent.sol](../../contracts/src/exits/payment/controllers/PaymentChallengeIFEOutputSpent.sol)

**PaymentChallengeIFEOutputSpent**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 contract SpendingConditionRegistry spendingConditionRegistry,
 uint256 safeGasStipend
}
```

**Events**

```js
event InFlightExitOutputBlocked(address indexed challenger, bytes32 indexed txHash, uint16  outputIndex);
```

## Functions

- [run(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#run)
- [verifyInFlightTransactionStandardFinalized(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#verifyinflighttransactionstandardfinalized)
- [verifyChallengingTransactionProtocolFinalized(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#verifychallengingtransactionprotocolfinalized)
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

### verifyChallengingTransactionProtocolFinalized

```js
function verifyChallengingTransactionProtocolFinalized(struct PaymentChallengeIFEOutputSpent.Controller controller, struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args) private view
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
* [ExitBounty](ExitBounty.md)
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
