# BlockController.sol

View Source: [contracts/src/framework/BlockController.sol](../../contracts/src/framework/BlockController.sol)

**↗ Extends: [OnlyFromAddress](OnlyFromAddress.md), [VaultRegistry](VaultRegistry.md)**
**↘ Derived Contracts: [PlasmaFramework](PlasmaFramework.md)**

**BlockController**

Controls the logic and functions for block submissions in PlasmaFramework

## Contract Members
**Constants & Variables**

```js
address public authority;
uint256 public childBlockInterval;
uint256 public nextChildBlock;
uint256 public nextDeposit;
bool public isChildChainActivated;
mapping(uint256 => struct BlockModel.Block) public blocks;

```

**Events**

```js
event BlockSubmitted(uint256  blockNumber);
event ChildChainActivated(address  authority);
```

## Functions

- [(uint256 _interval, uint256 _minExitPeriod, uint256 _initialImmuneVaults, address _authority)](#)
- [activateChildChain()](#activatechildchain)
- [submitBlock(bytes32 _blockRoot)](#submitblock)
- [submitDepositBlock(bytes32 _blockRoot)](#submitdepositblock)
- [nextDepositBlock()](#nextdepositblock)
- [isDeposit(uint256 blockNum)](#isdeposit)

### 

```js
function (uint256 _interval, uint256 _minExitPeriod, uint256 _initialImmuneVaults, address _authority) public nonpayable VaultRegistry 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _interval | uint256 |  | 
| _minExitPeriod | uint256 |  | 
| _initialImmuneVaults | uint256 |  | 
| _authority | address |  | 

### activateChildChain

Activates the child chain so that child chain can start to submit child blocks to root chain

```js
function activateChildChain() external nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### submitBlock

Allows the authority to submit the Merkle root of a Plasma block

```js
function submitBlock(bytes32 _blockRoot) external nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _blockRoot | bytes32 | Merkle root of the Plasma block | 

### submitDepositBlock

Submits a block for deposit

```js
function submitDepositBlock(bytes32 _blockRoot) public nonpayable onlyFromNonQuarantinedVault 
returns(uint256)
```

**Returns**

The deposit block number

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _blockRoot | bytes32 | Merkle root of the Plasma block | 

### nextDepositBlock

```js
function nextDepositBlock() public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### isDeposit

```js
function isDeposit(uint256 blockNum) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNum | uint256 |  | 

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
