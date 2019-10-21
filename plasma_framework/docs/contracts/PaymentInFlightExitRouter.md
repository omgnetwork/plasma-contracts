# PaymentInFlightExitRouter.sol

View Source: [contracts/src/exits/payment/routers/PaymentInFlightExitRouter.sol](../../contracts/src/exits/payment/routers/PaymentInFlightExitRouter.sol)

**↗ Extends: [IExitProcessor](IExitProcessor.md), [OnlyFromAddress](OnlyFromAddress.md), [OnlyWithValue](OnlyWithValue.md), [FailFastReentrancyGuard](FailFastReentrancyGuard.md)**
**↘ Derived Contracts: [PaymentExitGame](PaymentExitGame.md)**

**PaymentInFlightExitRouter**

## Contract Members
**Constants & Variables**

```js
//public members
uint128 public constant INITIAL_IFE_BOND_SIZE;
uint128 public constant INITIAL_PB_BOND_SIZE;
uint16 public constant BOND_LOWER_BOUND_DIVISOR;
uint16 public constant BOND_UPPER_BOUND_MULTIPLIER;

//internal members
struct PaymentExitDataModel.InFlightExitMap internal inFlightExitMap;
struct PaymentStartInFlightExit.Controller internal startInFlightExitController;
struct PaymentPiggybackInFlightExit.Controller internal piggybackInFlightExitController;
struct PaymentChallengeIFENotCanonical.Controller internal challengeCanonicityController;
struct PaymentChallengeIFEInputSpent.Controller internal challengeInputSpentController;
struct PaymentProcessInFlightExit.Controller internal processInflightExitController;
struct PaymentChallengeIFEOutputSpent.Controller internal challengeOutputSpentController;
struct BondSize.Params internal startIFEBond;
struct BondSize.Params internal piggybackBond;

//private members
contract PlasmaFramework private framework;

```

**Events**

```js
event IFEBondUpdated(uint128  bondSize);
event PiggybackBondUpdated(uint128  bondSize);
event InFlightExitStarted(address indexed initiator, bytes32  txHash);
event InFlightExitInputPiggybacked(address indexed exitTarget, bytes32  txHash, uint16  inputIndex);
event InFlightExitOmitted(uint160 indexed exitId, address  token);
event InFlightExitOutputWithdrawn(uint160 indexed exitId, uint16  outputIndex);
event InFlightExitInputWithdrawn(uint160 indexed exitId, uint16  inputIndex);
event InFlightExitOutputPiggybacked(address indexed exitTarget, bytes32  txHash, uint16  outputIndex);
event InFlightExitChallenged(address indexed challenger, bytes32  txHash, uint256  challengeTxPosition);
event InFlightExitChallengeResponded(address  challenger, bytes32  txHash, uint256  challengeTxPosition);
event InFlightExitInputBlocked(address indexed challenger, bytes32  txHash, uint16  inputIndex);
event InFlightExitOutputBlocked(address indexed challenger, bytes32  ifeTxHash, uint16  outputIndex);
```

## Functions

- [(PlasmaFramework plasmaFramework, uint256 ethVaultId, uint256 erc20VaultId, OutputGuardHandlerRegistry outputGuardHandlerRegistry, SpendingConditionRegistry spendingConditionRegistry, IStateTransitionVerifier stateTransitionVerifier, ITxFinalizationVerifier txFinalizationVerifier, uint256 supportedTxType)](#)
- [inFlightExits(uint160 exitId)](#inflightexits)
- [startInFlightExit(struct PaymentInFlightExitRouterArgs.StartExitArgs args)](#startinflightexit)
- [piggybackInFlightExitOnInput(struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs args)](#piggybackinflightexitoninput)
- [piggybackInFlightExitOnOutput(struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs args)](#piggybackinflightexitonoutput)
- [challengeInFlightExitNotCanonical(struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs args)](#challengeinflightexitnotcanonical)
- [respondToNonCanonicalChallenge(bytes inFlightTx, uint256 inFlightTxPos, bytes inFlightTxInclusionProof)](#respondtononcanonicalchallenge)
- [challengeInFlightExitInputSpent(struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args)](#challengeinflightexitinputspent)
- [challengeInFlightExitOutputSpent(struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args)](#challengeinflightexitoutputspent)
- [processInFlightExit(uint160 exitId, address token)](#processinflightexit)
- [startIFEBondSize()](#startifebondsize)
- [updateStartIFEBondSize(uint128 newBondSize)](#updatestartifebondsize)
- [piggybackBondSize()](#piggybackbondsize)
- [updatePiggybackBondSize(uint128 newBondSize)](#updatepiggybackbondsize)

### 

```js
function (PlasmaFramework plasmaFramework, uint256 ethVaultId, uint256 erc20VaultId, OutputGuardHandlerRegistry outputGuardHandlerRegistry, SpendingConditionRegistry spendingConditionRegistry, IStateTransitionVerifier stateTransitionVerifier, ITxFinalizationVerifier txFinalizationVerifier, uint256 supportedTxType) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| plasmaFramework | PlasmaFramework |  | 
| ethVaultId | uint256 |  | 
| erc20VaultId | uint256 |  | 
| outputGuardHandlerRegistry | OutputGuardHandlerRegistry |  | 
| spendingConditionRegistry | SpendingConditionRegistry |  | 
| stateTransitionVerifier | IStateTransitionVerifier |  | 
| txFinalizationVerifier | ITxFinalizationVerifier |  | 
| supportedTxType | uint256 |  | 

### inFlightExits

Getter functions to retrieve in-flight exit data of the PaymentExitGame

```js
function inFlightExits(uint160 exitId) public view
returns(struct PaymentExitDataModel.InFlightExit)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint160 | The exit ID of the in-flight exit | 

### startInFlightExit

Starts withdrawal from a transaction that may be in-flight

```js
function startInFlightExit(struct PaymentInFlightExitRouterArgs.StartExitArgs args) public payable nonReentrant onlyWithValue 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentInFlightExitRouterArgs.StartExitArgs | Input argument data to challenge (see also struct 'StartExitArgs') | 

### piggybackInFlightExitOnInput

Piggyback on an input of an in-flight exiting tx. Processed only if the in-flight exit is non-canonical.

```js
function piggybackInFlightExitOnInput(struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs args) public payable nonReentrant onlyWithValue 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnInputArgs | Input argument data to piggyback (see also struct 'PiggybackInFlightExitOnInputArgs') | 

### piggybackInFlightExitOnOutput

Piggyback on an output of an in-flight exiting tx. Processed only if the in-flight exit is canonical.

```js
function piggybackInFlightExitOnOutput(struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs args) public payable nonReentrant onlyWithValue 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentInFlightExitRouterArgs.PiggybackInFlightExitOnOutputArgs | Input argument data to piggyback (see also struct 'PiggybackInFlightExitOnOutputArgs') | 

### challengeInFlightExitNotCanonical

Challenges an in-flight exit to be non-canonical

```js
function challengeInFlightExitNotCanonical(struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs args) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentInFlightExitRouterArgs.ChallengeCanonicityArgs | Input argument data to challenge (see also struct 'ChallengeCanonicityArgs') | 

### respondToNonCanonicalChallenge

Respond to a non-canonical challenge by providing its position and by proving its correctness

```js
function respondToNonCanonicalChallenge(bytes inFlightTx, uint256 inFlightTxPos, bytes inFlightTxInclusionProof) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| inFlightTx | bytes | The RLP-encoded in-flight transaction | 
| inFlightTxPos | uint256 | The UTXO position of the in-flight exit. The outputIndex should be set to 0. | 
| inFlightTxInclusionProof | bytes | Inclusion proof for the in-flight tx | 

### challengeInFlightExitInputSpent

Challenges an exit from in-flight transaction input

```js
function challengeInFlightExitInputSpent(struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs args) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentInFlightExitRouterArgs.ChallengeInputSpentArgs | Argument data to challenge (see also struct 'ChallengeInputSpentArgs') | 

### challengeInFlightExitOutputSpent

Challenges an exit from in-flight transaction output

```js
function challengeInFlightExitOutputSpent(struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent args) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| args | struct PaymentInFlightExitRouterArgs.ChallengeOutputSpent | Argument data to challenge (see also struct 'ChallengeOutputSpent') | 

### processInFlightExit

Process in-flight exit

```js
function processInFlightExit(uint160 exitId, address token) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| exitId | uint160 | The in-flight exit ID | 
| token | address | The token (in erc20 address or address(0) for ETH) of the exiting output | 

### startIFEBondSize

Retrieves the in-flight exit bond size

```js
function startIFEBondSize() public view
returns(uint128)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### updateStartIFEBondSize

Updates the in-flight exit bond size, taking two days to become effective.

```js
function updateStartIFEBondSize(uint128 newBondSize) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBondSize | uint128 | The new bond size | 

### piggybackBondSize

Retrieves the piggyback bond size

```js
function piggybackBondSize() public view
returns(uint128)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### updatePiggybackBondSize

Updates the piggyback bond size, taking two days to become effective

```js
function updatePiggybackBondSize(uint128 newBondSize) public nonpayable onlyFrom 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBondSize | uint128 | The new bond size | 

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
