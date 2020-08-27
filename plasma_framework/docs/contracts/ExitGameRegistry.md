# ExitGameRegistry.sol

View Source: [contracts/src/framework/registries/ExitGameRegistry.sol](../../contracts/src/framework/registries/ExitGameRegistry.sol)

**↗ Extends: [OnlyFromAddress](OnlyFromAddress.md)**
**↘ Derived Contracts: [ExitGameController](ExitGameController.md), [PlasmaFramework](PlasmaFramework.md)**

**ExitGameRegistry**

## Contract Members
**Constants & Variables**

```js
mapping(uint256 => address) private _exitGames;
mapping(address => uint256) private _exitGameToTxType;
mapping(uint256 => uint8) private _protocols;
struct Quarantine.Data private _exitGameQuarantine;

```

**Events**

```js
event ExitGameRegistered(uint256  txType, address  exitGameAddress, uint8  protocol);
```

## Modifiers

- [onlyFromNonQuarantinedExitGame](#onlyfromnonquarantinedexitgame)

### onlyFromNonQuarantinedExitGame

A modifier to verify that the call is from a non-quarantined exit game

```js
modifier onlyFromNonQuarantinedExitGame() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)](#)
- [getMaintainer()](#getmaintainer)
- [isExitGameSafeToUse(address _contract)](#isexitgamesafetouse)
- [registerExitGame(uint256 _txType, address _contract, uint8 _protocol)](#registerexitgame)
- [protocols(uint256 _txType)](#protocols)
- [exitGames(uint256 _txType)](#exitgames)
- [exitGameToTxType(address _exitGame)](#exitgametotxtype)

### 

It takes at least 3 * minExitPeriod before each new exit game contract is able to start protecting existing transactions
     see: https://github.com/omisego/plasma-contracts/issues/172
          https://github.com/omisego/plasma-contracts/issues/197

```js
function (uint256 _minExitPeriod, uint256 _initialImmuneExitGames) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _minExitPeriod | uint256 |  | 
| _initialImmuneExitGames | uint256 |  | 

### getMaintainer

⤾ overrides [VaultRegistry.getMaintainer](VaultRegistry.md#getmaintainer)

⤿ Overridden Implementation(s): [PlasmaFramework.getMaintainer](PlasmaFramework.md#getmaintainer)

interface to get the 'maintainer' address.

```js
function getMaintainer() public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### isExitGameSafeToUse

Checks whether the contract is safe to use and is not under quarantine

```js
function isExitGameSafeToUse(address _contract) public view
returns(bool)
```

**Returns**

boolean Whether the contract is safe to use and is not under quarantine

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _contract | address | Address of the exit game contract | 

### registerExitGame

Registers an exit game within the PlasmaFramework. Only the maintainer can call the function.

```js
function registerExitGame(uint256 _txType, address _contract, uint8 _protocol) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txType | uint256 | The tx type where the exit game wants to register | 
| _contract | address | Address of the exit game contract | 
| _protocol | uint8 | The transaction protocol, either 1 for MVP or 2 for MoreVP | 

### protocols

Public getter for retrieving protocol with tx type

```js
function protocols(uint256 _txType) public view
returns(uint8)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txType | uint256 |  | 

### exitGames

Public getter for retrieving exit game address with tx type

```js
function exitGames(uint256 _txType) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txType | uint256 |  | 

### exitGameToTxType

Public getter for retrieving tx type with exit game address

```js
function exitGameToTxType(address _exitGame) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _exitGame | address |  | 

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
