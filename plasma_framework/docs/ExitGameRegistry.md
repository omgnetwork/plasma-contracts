# ExitGameRegistry.sol

View Source: [contracts/src/framework/registries/ExitGameRegistry.sol](../contracts/src/framework/registries/ExitGameRegistry.sol)

**↗ Extends: [Operated](Operated.md)**
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

modifier to check the call is from a non-quarantined exit game

```js
modifier onlyFromNonQuarantinedExitGame() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)](#)
- [isExitGameSafeToUse(address _contract)](#isexitgamesafetouse)
- [registerExitGame(uint256 _txType, address _contract, uint8 _protocol)](#registerexitgame)
- [protocols(uint256 _txType)](#protocols)
- [exitGames(uint256 _txType)](#exitgames)
- [exitGameToTxType(address _exitGame)](#exitgametotxtype)

### 

For each new exit game contract, it should take at least 3 * minExitPeriod to start take effect to protect existing transactions.
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

### isExitGameSafeToUse

Checks whether the contract is safe to use and is not under quarantine

```js
function isExitGameSafeToUse(address _contract) public view
returns(bool)
```

**Returns**

boolean whether the contract is safe to use and is not under quarantine.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _contract | address | address of the exit game contract | 

### registerExitGame

Register an exit game within the PlasmaFramework. The function can only be called by the maintainer.

```js
function registerExitGame(uint256 _txType, address _contract, uint8 _protocol) public nonpayable onlyOperator 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txType | uint256 | tx type that the exit game want to register to. | 
| _contract | address | address of the exit game contract. | 
| _protocol | uint8 | protocol of the transaction, 1 for MVP and 2 for MoreVP. | 

### protocols

public getter for getting protocol with tx type

```js
function protocols(uint256 _txType) public view
returns(uint8)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txType | uint256 |  | 

### exitGames

public getter for getting exit game address with tx type

```js
function exitGames(uint256 _txType) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _txType | uint256 |  | 

### exitGameToTxType

public getter for getting tx type with exit game address

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
