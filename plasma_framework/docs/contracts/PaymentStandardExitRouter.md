# PaymentStandardExitRouter.sol

View Source: [contracts/src/exits/payment/routers/PaymentStandardExitRouter.sol](../../contracts/src/exits/payment/routers/PaymentStandardExitRouter.sol)

**↗ Extends: [IExitProcessor](IExitProcessor.md), [OnlyFromAddress](OnlyFromAddress.md), [OnlyWithValue](OnlyWithValue.md), [FailFastReentrancyGuard](FailFastReentrancyGuard.md)**
**↘ Derived Contracts: [PaymentExitGame](PaymentExitGame.md)**

**PaymentStandardExitRouter**

## Contract Members
**Constants & Variables**

```js
//public members
uint128 public constant INITIAL_BOND_SIZE;
uint16 public constant BOND_LOWER_BOUND_DIVISOR;
uint16 public constant BOND_UPPER_BOUND_MULTIPLIER;

//internal members
struct PaymentExitDataModel.StandardExitMap internal standardExitMap;
struct PaymentStartStandardExit.Controller internal startStandardExitController;
struct PaymentProcessStandardExit.Controller internal processStandardExitController;
struct PaymentChallengeStandardExit.Controller internal challengeStandardExitController;
struct BondSize.Params internal startStandardExitBond;

//private members
contract PlasmaFramework private framework;

```

**Events**

```js
event StandardExitBondUpdated(uint128  bondSize);
event ExitStarted(address indexed owner, uint160  exitId);
event ExitChallenged(uint256 indexed utxoPos);
event ExitOmitted(uint160 indexed exitId);
event ExitFinalized(uint160 indexed exitId);
```

## Functions

- [(PlasmaFramework plasmaFramework, uint256 ethVaultId, uint256 erc20VaultId, OutputGuardHandlerRegistry outputGuardHandlerRegistry, SpendingConditionRegistry spendingConditionRegistry, ITxFinalizationVerifier txFinalizationVerifier, uint256 safeGasStipend)](#)
- [standardExits(uint160 exitId)](#standardexits)
- [startStandardExitBondSize()](#startstandardexitbondsize)
- [updateStartStandardExitBondSize(uint128 newBondSize)](#updatestartstandardexitbondsize)
- [startStandardExit(struct PaymentStandardExitRouterArgs.StartStandardExitArgs args)](#startstandardexit)
- [challengeStandardExit(struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args)](#challengestandardexit)
- [processStandardExit(uint160 exitId, address token)](#processstandardexit)

### 

```js
function (PlasmaFramework plasmaFramework, uint256 ethVaultId, uint256 erc20VaultId, OutputGuardHandlerRegistry outputGuardHandlerRegistry, SpendingConditionRegistry spendingConditionRegistry, ITxFinalizationVerifier txFinalizationVerifier, uint256 safeGasStipend) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| plasmaFramework | PlasmaFramework |  | 
| ethVaultId | uint256 |  | 
| erc20VaultId | uint256 |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
| spendingConditionRegistry | SpendingConditionRegistry |  | 
| txFinalizationVerifier | ITxFinalizationVerifier |  | 
| safeGasStipend | uint256 |  | 

### standardExits

Getter retrieves standard exit data of the PaymentExitGame

```js
function standardExits(uint160 exitId) public view
returns(struct PaymentExitDataModel.StandardExit)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint160 | Exit ID of the standard exit | 

### startStandardExitBondSize

Retrieves the standard exit bond size

```js
function startStandardExitBondSize() public view
returns(uint128)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### updateStartStandardExitBondSize

Updates the standard exit bond size, taking two days to become effective

```js
function updateStartStandardExitBondSize(uint128 newBondSize) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBondSize | uint128 | The new bond size | 

### startStandardExit

Starts a standard exit of a given output, using output-age priority

```js
function startStandardExit(struct PaymentStandardExitRouterArgs.StartStandardExitArgs args) public payable nonReentrant onlyWithValue 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentStandardExitRouterArgs.StartStandardExitArgs |  | 

### challengeStandardExit

Challenge a standard exit by showing the exiting output was spent

```js
function challengeStandardExit(struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args) public payable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs |  | 

### processStandardExit

Process standard exit

```js
function processStandardExit(uint160 exitId, address token) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint160 | The standard exit ID | 
| token | address | The token (in erc20 address or address(0) for ETH) of the exiting output | 

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
