# PaymentChallengeIFENotCanonical.sol

View Source: [contracts/src/exits/payment/controllers/PaymentChallengeIFENotCanonical.sol](../../contracts/src/exits/payment/controllers/PaymentChallengeIFENotCanonical.sol)

**PaymentChallengeIFENotCanonical**

## Structs
### Controller

```js
struct Controller {
 contract PlasmaFramework framework,
 struct IsDeposit.Predicate isDeposit,
 contract SpendingConditionRegistry spendingConditionRegistry,
 contract OutputGuardHandlerRegistry outputGuardHandlerRegistry,
 contract ITxFinalizationVerifier txFinalizationVerifier,
 uint256 supportedTxType
}
```

**Events**

```js
event InFlightExitChallenged(address indexed challenger, bytes32  txHash, uint256  challengeTxPosition);
event InFlightExitChallengeResponded(address  challenger, bytes32  txHash, uint256  challengeTxPosition);
```

## Functions

- [buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, OutputGuardHandlerRegistry outputGuardHandlerRegistry, ITxFinalizationVerifier txFinalizationVerifier, uint256 supportedTxType)](#buildcontroller)
- [challenge(struct PaymentChallengeIFENotCanonical.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs args)](#challenge)
- [respond(struct PaymentChallengeIFENotCanonical.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, bytes inFlightTx, uint256 inFlightTxPos, bytes inFlightTxInclusionProof)](#respond)
- [verifyAndDeterminePositionOfTransactionIncludedInBlock(bytes txbytes, struct UtxoPosLib.UtxoPos utxoPos, bytes32 root, bytes inclusionProof)](#verifyanddeterminepositionoftransactionincludedinblock)
- [verifyCompetingTxFinalized(struct PaymentChallengeIFENotCanonical.Controller self, struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs args, struct WireTransaction.Output output)](#verifycompetingtxfinalized)

### buildController

Function that builds the controller struct

```js
function buildController(PlasmaFramework framework, SpendingConditionRegistry spendingConditionRegistry, OutputGuardHandlerRegistry outputGuardHandlerRegistry, ITxFinalizationVerifier txFinalizationVerifier, uint256 supportedTxType) public view
returns(struct PaymentChallengeIFENotCanonical.Controller)
```

**Returns**

Controller struct of PaymentChallengeIFENotCanonical

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| framework | PlasmaFramework |  | 
| spendingConditionRegistry | SpendingConditionRegistry |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
| txFinalizationVerifier | ITxFinalizationVerifier |  | 
| supportedTxType | uint256 |  | 

### challenge

Main logic implementation for 'challengeInFlightExitNotCanonical'

```js
function challenge(struct PaymentChallengeIFENotCanonical.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs args) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentChallengeIFENotCanonical.Controller | The controller struct | 
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| args | struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs | Arguments of 'challengeInFlightExitNotCanonical' function from client | 

### respond

Main logic implementation for 'respondToNonCanonicalChallenge'

```js
function respond(struct PaymentChallengeIFENotCanonical.Controller self, struct PaymentExitDataModel.InFlightExitMap inFlightExitMap, bytes inFlightTx, uint256 inFlightTxPos, bytes inFlightTxInclusionProof) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentChallengeIFENotCanonical.Controller | The controller struct | 
| inFlightExitMap | struct PaymentExitDataModel.InFlightExitMap | The storage of all in-flight exit data | 
| inFlightTx | bytes | The in-flight tx, in RLP-encoded bytes | 
| inFlightTxPos | uint256 | The UTXO position of the in-flight exit. Should hardcode 0 for the outputIndex. | 
| inFlightTxInclusionProof | bytes | Inclusion proof for the in-flight tx | 

### verifyAndDeterminePositionOfTransactionIncludedInBlock

```js
function verifyAndDeterminePositionOfTransactionIncludedInBlock(bytes txbytes, struct UtxoPosLib.UtxoPos utxoPos, bytes32 root, bytes inclusionProof) private pure
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| txbytes | bytes |  | 
| utxoPos | struct UtxoPosLib.UtxoPos |  | 
| root | bytes32 |  | 
| inclusionProof | bytes |  | 

### verifyCompetingTxFinalized

```js
function verifyCompetingTxFinalized(struct PaymentChallengeIFENotCanonical.Controller self, struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs args, struct WireTransaction.Output output) private view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| self | struct PaymentChallengeIFENotCanonical.Controller |  | 
| args | struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs |  | 
| output | struct WireTransaction.Output |  | 

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
