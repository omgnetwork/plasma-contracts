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
mapping(uint256 => contract IExitProcessor) public delegations;
mapping(bytes32 => contract PriorityQueue) public exitsQueues;
mapping(bytes32 => bool) public isOutputSpent;

```

**Events**

```js
event ExitQueueAdded(uint256  vaultId, address  token);
event ProcessedExitsNum(uint256  processedNum, uint256  vaultId, address  token);
event ExitQueued(uint160 indexed exitId, uint256  priority);
```

## Functions

- [(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)](#)
- [hasExitQueue(uint256 vaultId, address token)](#hasexitqueue)
- [addExitQueue(uint256 vaultId, address token)](#addexitqueue)
- [enqueue(uint256 vaultId, address token, uint64 exitableAt, struct TxPosLib.TxPos txPos, uint160 exitId, IExitProcessor exitProcessor)](#enqueue)
- [processExits(uint256 vaultId, address token, uint160 topExitId, uint256 maxExitsToProcess)](#processexits)
- [isAnyOutputsSpent(bytes32[] _outputIds)](#isanyoutputsspent)
- [batchFlagOutputsSpent(bytes32[] _outputIds)](#batchflagoutputsspent)
- [flagOutputSpent(bytes32 _outputId)](#flagoutputspent)
- [getNextExit(uint256 vaultId, address token)](#getnextexit)
- [exitQueueKey(uint256 vaultId, address token)](#exitqueuekey)
- [hasExitQueue(bytes32 queueKey)](#hasexitqueue)

### 

```js
function (uint256 _minExitPeriod, uint256 _initialImmuneExitGames) public nonpayable ExitGameRegistry 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _minExitPeriod | uint256 |  | 
| _initialImmuneExitGames | uint256 |  | 

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
function enqueue(uint256 vaultId, address token, uint64 exitableAt, struct TxPosLib.TxPos txPos, uint160 exitId, IExitProcessor exitProcessor) external nonpayable onlyFromNonQuarantinedExitGame 
returns(uint256)
```

**Returns**

A unique priority number computed for the exit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 | Vault ID of the vault that stores exiting funds | 
| token | address | Token for the exit | 
| exitableAt | uint64 | The earliest time a specified exit can be processed | 
| txPos | struct TxPosLib.TxPos | Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position. | 
| exitId | uint160 | ID used by the exit processor contract to determine how to process the exit | 
| exitProcessor | IExitProcessor | The exit processor contract, called during "processExits" | 

### processExits

Processes any exits that have completed the challenge period. Exits are processed according to the exit priority.

```js
function processExits(uint256 vaultId, address token, uint160 topExitId, uint256 maxExitsToProcess) external nonpayable
```

**Returns**

Total number of processed exits

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vaultId | uint256 | Vault ID of the vault that stores exiting funds | 
| token | address | The token type to process | 
| topExitId | uint160 | Unique identifier for prioritizing the first exit to process. Set to zero to skip this check. | 
| maxExitsToProcess | uint256 | Maximum number of exits to process | 

### isAnyOutputsSpent

Checks whether any of the output with the given outputIds is already spent

```js
function isAnyOutputsSpent(bytes32[] _outputIds) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputIds | bytes32[] | Output IDs to check | 

### batchFlagOutputsSpent

Batch flags already spent outputs

```js
function batchFlagOutputsSpent(bytes32[] _outputIds) external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputIds | bytes32[] | Output IDs to flag | 

### flagOutputSpent

Flags a single output as spent

```js
function flagOutputSpent(bytes32 _outputId) external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputId | bytes32 | The output ID to flag as spent | 

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
