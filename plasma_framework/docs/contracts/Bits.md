# Bits (Bits.sol)

View Source: [contracts/src/utils/Bits.sol](../../contracts/src/utils/Bits.sol)

**Bits**

Operations on individual bits of a word

## Contract Members
**Constants & Variables**

```js
uint256 internal constant ONE;

```

## Functions

- [setBit(uint256 _self, uint8 _index)](#setbit)
- [clearBit(uint256 _self, uint8 _index)](#clearbit)
- [getBit(uint256 _self, uint8 _index)](#getbit)
- [bitSet(uint256 _self, uint8 _index)](#bitset)

### setBit

Sets the bit at the given '_index' in '_self' to '1'

```js
function setBit(uint256 _self, uint8 _index) internal pure
returns(uint256)
```

**Returns**

The modified value

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _self | uint256 | Uint to modify | 
| _index | uint8 | Index of the bit to set | 

### clearBit

Sets the bit at the given '_index' in '_self' to '0'

```js
function clearBit(uint256 _self, uint8 _index) internal pure
returns(uint256)
```

**Returns**

The modified value

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _self | uint256 | Uint to modify | 
| _index | uint8 | Index of the bit to set | 

### getBit

Returns the bit at the given '_index' in '_self'

```js
function getBit(uint256 _self, uint8 _index) internal pure
returns(uint8)
```

**Returns**

The value of the bit at '_index'

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _self | uint256 | Uint to check | 
| _index | uint8 | Index of the bit to retrieve | 

### bitSet

Checks if the bit at the given '_index' in '_self' is '1'

```js
function bitSet(uint256 _self, uint8 _index) internal pure
returns(bool)
```

**Returns**

True, if the bit is '0'; otherwise, False

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _self | uint256 | Uint to check | 
| _index | uint8 | Index of the bit to check | 

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
* [PriorityQueue](PriorityQueue.md)
* [Protocol](Protocol.md)
* [Quarantine](Quarantine.md)
* [RLPReader](RLPReader.md)
* [SafeERC20](SafeERC20.md)
* [SafeEthTransfer](SafeEthTransfer.md)
* [SafeMath](SafeMath.md)
* [SpendingConditionRegistry](SpendingConditionRegistry.md)
* [TxPosLib](TxPosLib.md)
* [UtxoPosLib](UtxoPosLib.md)
* [Vault](Vault.md)
* [VaultRegistry](VaultRegistry.md)
