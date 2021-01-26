# ExitGameController.sol

View Source: [contracts/src/framework/ExitGameController.sol](../../contracts/src/framework/ExitGameController.sol)

**↗ Extends: [ExitGameRegistry](ExitGameRegistry.md)**
**↘ Derived Contracts: [PlasmaFramework](PlasmaFramework.md)**

**ExitGameController**

Controls the logic and functions for ExitGame to interact with the PlasmaFramework
        Plasma M(ore)VP relies on exit priority to secure the user from invalid transactions
        The priority queue ensures the exit is processed with the exit priority
        For details, see the Plasma MVP spec: https://ethresear.ch/t/minimal-viable-plasma/426

## Contract Members
**Constants & Variables**

```js
//public members
mapping(bytes32 => contract IExitProcessor) public delegations;
mapping(bytes32 => contract PriorityQueue) public exitsQueues;
mapping(bytes32 => uint168) public outputsFinalizations;

//private members
bool private mutex;

```

**Events**

```js
event ExitQueueAdded(uint256  vaultId, address  token);
event ProcessedExitsNum(uint256  processedNum, uint256  vaultId, address  token);
event ExitQueued(uint168 indexed exitId, uint256  priority);
```

## Modifiers

- [nonReentrant](#nonreentrant)

### nonReentrant

Prevents reentrant calls by using a mutex.

```js
modifier nonReentrant() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)](#)
- [activateNonReentrant()](#activatenonreentrant)
- [deactivateNonReentrant()](#deactivatenonreentrant)
- [hasExitQueue(uint256 vaultId, address token)](#hasexitqueue)
- [addExitQueue(uint256 vaultId, address token)](#addexitqueue)
- [enqueue(uint256 vaultId, address token, uint32 exitableAt, struct PosLib.Position txPos, uint168 exitId, IExitProcessor exitProcessor)](#enqueue)
- [processExits(uint256 vaultId, address token, uint168 topExitId, uint256 maxExitsToProcess, bytes32 senderData)](#processexits)
- [isAnyInputFinalizedByOtherExit(bytes32[] _outputIds, uint168 exitId)](#isanyinputfinalizedbyotherexit)
- [batchFlagOutputsFinalized(bytes32[] outputIds, uint168 exitId)](#batchflagoutputsfinalized)
- [flagOutputFinalized(bytes32 outputId, uint168 exitId)](#flagoutputfinalized)
- [isOutputFinalized(bytes32 outputId)](#isoutputfinalized)
- [getNextExit(uint256 vaultId, address token)](#getnextexit)
- [exitQueueKey(uint256 vaultId, address token)](#exitqueuekey)
- [hasExitQueue(bytes32 queueKey)](#hasexitqueue)
- [getDelegationKey(uint256 priority, uint256 vaultId, address token)](#getdelegationkey)

### 

```js
function (uint256 _minExitPeriod, uint256 _initialImmuneExitGames) public nonpayable ExitGameRegistry 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _minExitPeriod | uint256 |  | 
| _initialImmuneExitGames | uint256 |  | 

### activateNonReentrant

Activates non reentrancy mode
        Guards against reentering into publicly accessible code that modifies state related to exits

```js
function activateNonReentrant() external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### deactivateNonReentrant

Deactivates non reentrancy mode

```js
function deactivateNonReentrant() external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### hasExitQueue

Checks if the queue for a specified token was created

```js
function hasExitQueue(uint256 vaultId, address token) public view
returns(bool)
```

**Returns**

bool Defines whether the queue for a token was created

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 | ID of the vault that handles the token | 
| token | address | Address of the token | 

### addExitQueue

Adds queue to the Plasma framework

```js
function addExitQueue(uint256 vaultId, address token) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 | ID of the vault | 
| token | address | Address of the token | 

### enqueue

Enqueue exits from exit game contracts is a function that places the exit into the
        priority queue to enforce the priority of exit during 'processExits'

```js
function enqueue(uint256 vaultId, address token, uint32 exitableAt, struct PosLib.Position txPos, uint168 exitId, IExitProcessor exitProcessor) external nonpayable onlyFromNonQuarantinedExitGame 
returns(uint256)
```

**Returns**

A unique priority number computed for the exit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 | Vault ID of the vault that stores exiting funds | 
| token | address | Token for the exit | 
| exitableAt | uint32 | The earliest time a specified exit can be processed | 
| txPos | struct PosLib.Position | Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position. | 
| exitId | uint168 | ID used by the exit processor contract to determine how to process the exit | 
| exitProcessor | IExitProcessor | The exit processor contract, called during "processExits" | 

### processExits

Processes any exits that have completed the challenge period. Exits are processed according to the exit priority.

```js
function processExits(uint256 vaultId, address token, uint168 topExitId, uint256 maxExitsToProcess, bytes32 senderData) external nonpayable nonReentrant 
```

**Returns**

Total number of processed exits

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 | Vault ID of the vault that stores exiting funds | 
| token | address | The token type to process | 
| topExitId | uint168 | Unique identifier for prioritizing the first exit to process. Set to zero to skip this check. | 
| maxExitsToProcess | uint256 | Maximum number of exits to process | 
| senderData | bytes32 | A keccak256 hash of the sender's address | 

### isAnyInputFinalizedByOtherExit

Checks whether any of the output with the given outputIds is already spent

```js
function isAnyInputFinalizedByOtherExit(bytes32[] _outputIds, uint168 exitId) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputIds | bytes32[] | Output IDs to check | 
| exitId | uint168 |  | 

### batchFlagOutputsFinalized

Batch flags already spent outputs (only not already spent)

```js
function batchFlagOutputsFinalized(bytes32[] outputIds, uint168 exitId) external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputIds | bytes32[] | Output IDs to flag | 
| exitId | uint168 |  | 

### flagOutputFinalized

Flags a single output as spent if it is not flagged already

```js
function flagOutputFinalized(bytes32 outputId, uint168 exitId) external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputId | bytes32 | The output ID to flag as spent | 
| exitId | uint168 |  | 

### isOutputFinalized

Checks whether output with a given outputId is finalized

```js
function isOutputFinalized(bytes32 outputId) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| outputId | bytes32 | Output ID to check | 

### getNextExit

```js
function getNextExit(uint256 vaultId, address token) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 |  | 
| token | address |  | 

### exitQueueKey

```js
function exitQueueKey(uint256 vaultId, address token) private pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 |  | 
| token | address |  | 

### hasExitQueue

```js
function hasExitQueue(bytes32 queueKey) private view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| queueKey | bytes32 |  | 

### getDelegationKey

```js
function getDelegationKey(uint256 priority, uint256 vaultId, address token) private pure
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| priority | uint256 |  | 
| vaultId | uint256 |  | 
| token | address |  | 

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
