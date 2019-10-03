# ExitGameController.sol

View Source: [contracts/src/framework/ExitGameController.sol](../contracts/src/framework/ExitGameController.sol)

**↗ Extends: [ExitGameRegistry](ExitGameRegistry.md)**
**↘ Derived Contracts: [PlasmaFramework](PlasmaFramework.md)**

**ExitGameController**

Controls the logic and functions for ExitGame to interact with PlasmaFramework.
        Plasma M(ore)VP relies on exit priority to secure the user from invalid transactions.
        As a result, priority queue is used here to promise the exit would be processed with the exit priority.
        For details, see the Plasma MVP spec: https://ethresear.ch/t/minimal-viable-plasma/426

## Contract Members
**Constants & Variables**

```js
mapping(uint256 => contract IExitProcessor) public delegations;
mapping(address => contract PriorityQueue) public exitsQueues;
mapping(bytes32 => bool) public isOutputSpent;

```

**Events**

```js
event TokenAdded(address  token);
event ProcessedExitsNum(uint256  processedNum, address  token);
event ExitQueued(uint160 indexed exitId, uint256  uniquePriority);
```

## Functions

- [(uint256 _minExitPeriod, uint256 _initialImmuneExitGames)](#)
- [addToken(address _token)](#addtoken)
- [hasToken(address _token)](#hastoken)
- [enqueue(address _token, uint64 _exitableAt, struct TxPosLib.TxPos _txPos, uint160 _exitId, IExitProcessor _exitProcessor)](#enqueue)
- [processExits(address _token, uint160 _topExitId, uint256 _maxExitsToProcess)](#processexits)
- [isAnyOutputsSpent(bytes32[] _outputIds)](#isanyoutputsspent)
- [batchFlagOutputsSpent(bytes32[] _outputIds)](#batchflagoutputsspent)
- [flagOutputSpent(bytes32 _outputId)](#flagoutputspent)

### 

```js
function (uint256 _minExitPeriod, uint256 _initialImmuneExitGames) public nonpayable ExitGameRegistry 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _minExitPeriod | uint256 |  | 
| _initialImmuneExitGames | uint256 |  | 

### addToken

Add token to the plasma framework and initiate the priority queue.

```js
function addToken(address _token) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | Address of the token. | 

### hasToken

Checks if the queue for a particular token was created.

```js
function hasToken(address _token) public view
returns(bool)
```

**Returns**

bool whether the queue for a token was created.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | address of the token. | 

### enqueue

Enqueue exits from exit game contracts. This 'enqueue' function puts the exit into the
        priority queue to enforce the priority of exit during 'processExits'.

```js
function enqueue(address _token, uint64 _exitableAt, struct TxPosLib.TxPos _txPos, uint160 _exitId, IExitProcessor _exitProcessor) external nonpayable onlyFromNonQuarantinedExitGame 
returns(uint256)
```

**Returns**

a unique priority number computed for the exit

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | Token for the exit | 
| _exitableAt | uint64 | The earliest time that such exit can be processed | 
| _txPos | struct TxPosLib.TxPos | Transaction position for the exit priority. For SE it should be the exit tx, for IFE it should be the youngest input tx position. | 
| _exitId | uint160 | Id for the exit processor contract to understand how to process such exit | 
| _exitProcessor | IExitProcessor | The exit processor contract that would be called during "processExits" | 

### processExits

Processes any exits that have completed the challenge period. Exits would be processed according to the exit priority.

```js
function processExits(address _token, uint160 _topExitId, uint256 _maxExitsToProcess) external nonpayable
```

**Returns**

total number of processed exits

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | token type to process. | 
| _topExitId | uint160 | unique priority of the first exit that should be processed. Set to zero to skip the check. | 
| _maxExitsToProcess | uint256 | maximal number of exits to process. | 

### isAnyOutputsSpent

Checks if any of the output with the given outputIds is spent already.

```js
function isAnyOutputsSpent(bytes32[] _outputIds) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputIds | bytes32[] | Output ids to be checked. | 

### batchFlagOutputsSpent

Batch flags outputs that are spent

```js
function batchFlagOutputsSpent(bytes32[] _outputIds) external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputIds | bytes32[] | Output ids to be flagged | 

### flagOutputSpent

Flags a single output as spent

```js
function flagOutputSpent(bytes32 _outputId) external nonpayable onlyFromNonQuarantinedExitGame 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _outputId | bytes32 | The output id to be flagged as spent | 

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
