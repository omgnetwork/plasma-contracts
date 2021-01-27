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
uint128 public constant INITIAL_EXIT_BOUNTY_SIZE;

//internal members
struct PaymentExitDataModel.StandardExitMap internal standardExitMap;
struct PaymentStartStandardExit.Controller internal startStandardExitController;
struct PaymentProcessStandardExit.Controller internal processStandardExitController;
struct PaymentChallengeStandardExit.Controller internal challengeStandardExitController;
struct BondSize.Params internal startStandardExitBond;

//private members
contract PlasmaFramework private framework;
bool private bootDone;

```

**Events**

```js
event StandardExitBondUpdated(uint128  bondSize, uint128  exitBountySize);
event ExitStarted(address indexed owner, uint168  exitId, uint256  utxoPos, bytes  outputTx);
event ExitChallenged(uint256 indexed utxoPos);
event ExitOmitted(uint168 indexed exitId);
event ExitFinalized(uint168 indexed exitId);
event BondReturnFailed(address indexed receiver, uint256  amount);
```

## Functions

- [boot(struct PaymentExitGameArgs.Args paymentExitGameArgs)](#boot)
- [standardExits(uint168[] exitIds)](#standardexits)
- [startStandardExitBondSize()](#startstandardexitbondsize)
- [updateStartStandardExitBondSize(uint128 newBondSize, uint128 newExitBountySize)](#updatestartstandardexitbondsize)
- [processStandardExitBountySize()](#processstandardexitbountysize)
- [startStandardExit(struct PaymentStandardExitRouterArgs.StartStandardExitArgs args)](#startstandardexit)
- [challengeStandardExit(struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args)](#challengestandardexit)
- [processStandardExit(uint168 exitId, address token, address payable processExitInitiator)](#processstandardexit)

### boot

⤿ Overridden Implementation(s): [PaymentInFlightExitRouter.boot](PaymentInFlightExitRouter.md#boot)

```js
function boot(struct PaymentExitGameArgs.Args paymentExitGameArgs) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| paymentExitGameArgs | struct PaymentExitGameArgs.Args |  | 

### standardExits

Getter retrieves standard exit data of the PaymentExitGame

```js
function standardExits(uint168[] exitIds) external view
returns(struct PaymentExitDataModel.StandardExit[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitIds | uint168[] | Exit IDs of the standard exits | 

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

Updates the standard exit bond size and/or the exit bounty size, taking two days to become effective

```js
function updateStartStandardExitBondSize(uint128 newBondSize, uint128 newExitBountySize) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBondSize | uint128 | The new bond size | 
| newExitBountySize | uint128 | The new exit bounty size | 

### processStandardExitBountySize

Retrieves the process standard exit bounty size

```js
function processStandardExitBountySize() public view
returns(uint128)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

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
function challengeStandardExit(struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs args) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentStandardExitRouterArgs.ChallengeStandardExitArgs |  | 

### processStandardExit

Process standard exit

```js
function processStandardExit(uint168 exitId, address token, address payable processExitInitiator) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint168 | The standard exit ID | 
| token | address | The token (in erc20 address or address(0) for ETH) of the exiting output | 
| processExitInitiator | address payable | The processExits() initiator | 

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
