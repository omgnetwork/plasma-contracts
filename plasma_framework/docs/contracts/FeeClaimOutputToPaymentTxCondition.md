# FeeClaimOutputToPaymentTxCondition.sol

View Source: [contracts/src/exits/fee/FeeClaimOutputToPaymentTxCondition.sol](../../contracts/src/exits/fee/FeeClaimOutputToPaymentTxCondition.sol)

**↗ Extends: [ISpendingCondition](ISpendingCondition.md)**

**FeeClaimOutputToPaymentTxCondition**

## Contract Members
**Constants & Variables**

```js
//public members
uint256 public feeTxType;
uint256 public feeClaimOutputType;
uint256 public paymentTxType;

//internal members
struct PaymentEip712Lib.Constants internal eip712;

```

## Functions

- [(PlasmaFramework _framework, uint256 _feeTxType, uint256 _feeClaimOutputType, uint256 _paymentTxType)](#)
- [verify(bytes feeTxBytes, uint256 utxoPos, bytes paymentTxBytes, uint16 inputIndex, bytes signature)](#verify)

### 

```js
function (PlasmaFramework _framework, uint256 _feeTxType, uint256 _feeClaimOutputType, uint256 _paymentTxType) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _framework | PlasmaFramework |  | 
| _feeTxType | uint256 |  | 
| _feeClaimOutputType | uint256 |  | 
| _paymentTxType | uint256 |  | 

### verify

⤾ overrides [ISpendingCondition.verify](ISpendingCondition.md#verify)

This implementation checks signature for spending fee claim output. It should be signed with the owner signature.
     The fee claim output that is spendable follows Fungible Token Output format.

```js
function verify(bytes feeTxBytes, uint256 utxoPos, bytes paymentTxBytes, uint16 inputIndex, bytes signature) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTxBytes | bytes | Encoded fee transaction | 
| utxoPos | uint256 | Position of the fee utxo | 
| paymentTxBytes | bytes | Payment transaction (in bytes) that spends the fee claim output | 
| inputIndex | uint16 | Input index of the payment tx that points to the fee claim output | 
| signature | bytes | Signature of the owner of fee claiming output | 

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
* [ExitBounty](ExitBounty.md)
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
