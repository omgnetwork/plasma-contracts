# VaultRegistry.sol

View Source: [contracts/src/framework/registries/VaultRegistry.sol](../../contracts/src/framework/registries/VaultRegistry.sol)

**↗ Extends: [OnlyFromAddress](OnlyFromAddress.md)**
**↘ Derived Contracts: [BlockController](BlockController.md), [PlasmaFramework](PlasmaFramework.md)**

**VaultRegistry**

## Contract Members
**Constants & Variables**

```js
mapping(uint256 => address) private _vaults;
mapping(address => uint256) private _vaultToId;
struct Quarantine.Data private _vaultQuarantine;

```

**Events**

```js
event VaultRegistered(uint256  vaultId, address  vaultAddress);
```

## Modifiers

- [onlyFromNonQuarantinedVault](#onlyfromnonquarantinedvault)

### onlyFromNonQuarantinedVault

A modifier to check that the call is from a non-quarantined vault

```js
modifier onlyFromNonQuarantinedVault() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(uint256 _minExitPeriod, uint256 _initialImmuneVaults)](#)
- [getMaintainer()](#getmaintainer)
- [registerVault(uint256 _vaultId, address _vaultAddress)](#registervault)
- [vaults(uint256 _vaultId)](#vaults)
- [vaultToId(address _vaultAddress)](#vaulttoid)

### 

It takes at least 2 minExitPeriod for each new vault contract to start.
     This is to protect deposit transactions already in mempool,
     and also make sure user only needs to SE within first week when invalid vault is registered.
     see: https://github.com/omisego/plasma-contracts/issues/412
          https://github.com/omisego/plasma-contracts/issues/173

```js
function (uint256 _minExitPeriod, uint256 _initialImmuneVaults) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _minExitPeriod | uint256 |  | 
| _initialImmuneVaults | uint256 |  | 

### getMaintainer

⤿ Overridden Implementation(s): [ExitGameRegistry.getMaintainer](ExitGameRegistry.md#getmaintainer),[PlasmaFramework.getMaintainer](PlasmaFramework.md#getmaintainer)

interface to get the 'maintainer' address.

```js
function getMaintainer() public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### registerVault

Register a vault within the PlasmaFramework. Only a maintainer can make the call.

```js
function registerVault(uint256 _vaultId, address _vaultAddress) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vaultId | uint256 | The ID for the vault contract to register | 
| _vaultAddress | address | Address of the vault contract | 

### vaults

Public getter for retrieving vault address with vault ID

```js
function vaults(uint256 _vaultId) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vaultId | uint256 |  | 

### vaultToId

Public getter for retrieving vault ID with vault address

```js
function vaultToId(address _vaultAddress) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vaultAddress | address |  | 

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
