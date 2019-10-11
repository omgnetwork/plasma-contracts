# Vault.sol

View Source: [contracts/src/vaults/Vault.sol](../contracts/src/vaults/Vault.sol)

**↗ Extends: [Operated](Operated.md)**
**↘ Derived Contracts: [Erc20Vault](Erc20Vault.md), [EthVault](EthVault.md)**

**Vault**

Base contract for vault implementation

## Contract Members
**Constants & Variables**

```js
//internal members
contract PlasmaFramework internal framework;
bytes32[16] internal zeroHashes;

//public members
address[2] public depositVerifiers;
uint256 public newDepositVerifierMaturityTimestamp;

```

**Events**

```js
event SetDepositVerifierCalled(address  nextDepositVerifier);
```

## Modifiers

- [onlyFromNonQuarantinedExitGame](#onlyfromnonquarantinedexitgame)

### onlyFromNonQuarantinedExitGame

Checks it is called by a non quarantined exit game contract

```js
modifier onlyFromNonQuarantinedExitGame() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(PlasmaFramework _framework)](#)
- [setDepositVerifier(address _verifier)](#setdepositverifier)
- [getEffectiveDepositVerifier()](#geteffectivedepositverifier)
- [_submitDepositBlock(bytes _depositTx)](#_submitdepositblock)

### 

```js
function (PlasmaFramework _framework) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _framework | PlasmaFramework |  | 

### setDepositVerifier

Sets the deposit verifier contract. This can be only called by the operator.

```js
function setDepositVerifier(address _verifier) public nonpayable onlyOperator 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _verifier | address | address of the verifier contract. | 

### getEffectiveDepositVerifier

Gets currently effective deposit verifier contract address.

```js
function getEffectiveDepositVerifier() public view
returns(address)
```

**Returns**

contract address of deposit verifier.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _submitDepositBlock

Generate and submit a deposit block root to the PlasmaFramework

```js
function _submitDepositBlock(bytes _depositTx) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _depositTx | bytes |  | 

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
* [Operated](Operated.md)
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
