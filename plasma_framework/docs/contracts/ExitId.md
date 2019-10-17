# ExitId.sol

View Source: [contracts/src/exits/utils/ExitId.sol](../../contracts/src/exits/utils/ExitId.sol)

**ExitId**

## Functions

- [isStandardExit(uint160 _exitId)](#isstandardexit)
- [getStandardExitId(bool _isDeposit, bytes _txBytes, struct UtxoPosLib.UtxoPos _utxoPos)](#getstandardexitid)
- [getInFlightExitId(bytes _txBytes)](#getinflightexitid)
- [_computeStandardExitId(bytes32 _txhash, uint16 _outputIndex)](#_computestandardexitid)

### isStandardExit

Checks whether exitId is a standard exit id or not.

```js
function isStandardExit(uint160 _exitId) internal pure
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _exitId | uint160 |  | 

### getStandardExitId

Given transaction bytes and UTXO position, returns its exit ID.

```js
function getStandardExitId(bool _isDeposit, bytes _txBytes, struct UtxoPosLib.UtxoPos _utxoPos) internal pure
returns(uint160)
```

**Returns**

_standardExitId Unique standard exit id.
    Anatomy of returned value, most significant bits first:
    8-bits - output index
    1-bit - in-flight flag (0 for standard exit)
    151-bits - hash(tx) or hash(tx|utxo) for deposit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _isDeposit | bool | whether the tx for the exitId is an deposit tx or not | 
| _txBytes | bytes | Transaction bytes. | 
| _utxoPos | struct UtxoPosLib.UtxoPos | UTXO position of the exiting output. | 

### getInFlightExitId

Given transaction bytes returns in-flight exit ID.

```js
function getInFlightExitId(bytes _txBytes) internal pure
returns(uint160)
```

**Returns**

Unique in-flight exit id.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txBytes | bytes | Transaction bytes. | 

### _computeStandardExitId

```js
function _computeStandardExitId(bytes32 _txhash, uint16 _outputIndex) private pure
returns(uint160)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txhash | bytes32 |  | 
| _outputIndex | uint16 |  | 

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
* [GracefulReentrancyGuard](GracefulReentrancyGuard.md)
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
* [ReentrancyGuard](ReentrancyGuard.md)
* [RLP](RLP.md)
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
