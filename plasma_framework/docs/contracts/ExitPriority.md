# ExitPriority.sol

View Source: [contracts/src/framework/utils/ExitPriority.sol](../../contracts/src/framework/utils/ExitPriority.sol)

**ExitPriority**

## Contract Members
**Constants & Variables**

```js
uint256 private constant SIZEOF_TIMESTAMP;
uint256 private constant SIZEOF_EXITID;

```

## Functions

- [computePriority(uint32 exitableAt, struct PosLib.Position txPos, uint168 exitId)](#computepriority)
- [parseExitableAt(uint256 priority)](#parseexitableat)
- [parseExitId(uint256 priority)](#parseexitid)

### computePriority

Detailed explanation on field lengths can be found at https://github.com/omisego/plasma-contracts/pull/303#discussion_r328850572

```js
function computePriority(uint32 exitableAt, struct PosLib.Position txPos, uint168 exitId) internal pure
returns(uint256)
```

**Returns**

An exit priority
  Anatomy of returned value, most significant bits first
  32 bits  - The exitable_at timestamp (in seconds); can represent dates until the year 2106
  56 bits  - The transaction position. Be aware that child chain block number jumps with the interval of CHILD_BLOCK_INTERVAL (usually 1000).
blocknum * (BLOCK_OFFSET / TX_OFFSET) + txindex; 56 bits can represent all transactions for 342 years, assuming a 15 second block time.
  168 bits - The exit id

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitableAt | uint32 |  | 
| txPos | struct PosLib.Position |  | 
| exitId | uint168 | Unique exit identifier | 

### parseExitableAt

```js
function parseExitableAt(uint256 priority) internal pure
returns(uint32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| priority | uint256 |  | 

### parseExitId

```js
function parseExitId(uint256 priority) internal pure
returns(uint168)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| priority | uint256 |  | 

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
