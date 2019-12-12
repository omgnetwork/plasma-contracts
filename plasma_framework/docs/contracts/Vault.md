# Vault.sol

View Source: [contracts/src/vaults/Vault.sol](../../contracts/src/vaults/Vault.sol)

**↗ Extends: [OnlyFromAddress](OnlyFromAddress.md)**
**↘ Derived Contracts: [Erc20Vault](Erc20Vault.md), [EthVault](EthVault.md)**

**Vault**

Base contract for vault implementation

## Contract Members
**Constants & Variables**

```js
//private members
bytes1 private constant LEAF_SALT;
bytes1 private constant NODE_SALT;

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

Checks whether the call originates from a non-quarantined exit game contract

```js
modifier onlyFromNonQuarantinedExitGame() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(PlasmaFramework _framework)](#)
- [getZeroHashes()](#getzerohashes)
- [setDepositVerifier(address _verifier)](#setdepositverifier)
- [getEffectiveDepositVerifier()](#geteffectivedepositverifier)
- [submitDepositBlock(bytes depositTx)](#submitdepositblock)
- [getDepositBlockRoot(bytes depositTx)](#getdepositblockroot)

### 

```js
function (PlasmaFramework _framework) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _framework | PlasmaFramework |  | 

### getZeroHashes

Pre-computes zero hashes to be used for building Merkle tree for deposit block

```js
function getZeroHashes() private pure
returns(bytes32[16])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### setDepositVerifier

Sets the deposit verifier contract, which may be called only by the operator

```js
function setDepositVerifier(address _verifier) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _verifier | address | Address of the verifier contract | 

### getEffectiveDepositVerifier

Retrieves the currently effective deposit verifier contract address

```js
function getEffectiveDepositVerifier() public view
returns(address)
```

**Returns**

Contract address of the deposit verifier

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### submitDepositBlock

Generate and submit a deposit block root to the PlasmaFramework

```js
function submitDepositBlock(bytes depositTx) internal nonpayable
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositTx | bytes |  | 

### getDepositBlockRoot

```js
function getDepositBlockRoot(bytes depositTx) private view
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| depositTx | bytes |  | 

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
