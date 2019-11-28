# Introduction
This document describes how to interact with the Plasma Abstract Layer Design (ALD) framework, and provides details about the components relevant to an integration, including:

- PlasmaFramework contract
  
  The entry point contract. Any integration with the system will interact with this contract.

- Block submission

  The child chain integration requires the data submitted in the blocks.

- Transactions
 
  Transactions are a fundamental part of the system. Any integration will require transaction-related information.

> ***Note**: For more information on the concepts relevant to this process, see the following documentation:*
- *[High level design of the Plasma Abstract Layer](https://docs.google.com/document/d/1PSxLnMskjqje4MksmW2msSSg-GtZoBSMNYey9nEDvt8)*
- *[Tesuji Plasma Blockchain Design](https://github.com/omisego/elixir-omg/blob/master/docs/tesuji_blockchain_design.md)*
- *[Solidity contract documentation](https://github.com/omisego/plasma-contracts/blob/master/plasma_framework/docs/PlasmaFramework.md)*


# PlasmaFramework
The PlasmaFramework contract may be viewed as the top-level contract. It contains the following components (described in more detail in this document):  

- BlockController
- ExitGameController
- ExitGameRegistry
- VaultRegistry
 

The PlasmaFramework contract provides access to components in the system. For example, to get the Payment ExitGame, call the following: 

 `PlasmaFramework.exitGames(PaymentType)`
 
The PlasmaFramework also provides the means for the `maintainer` to upgrade certain components in the system. Since this functionality has important security considerations, the PlasmaFramework emits events whenever a component is added. The Watchers monitor these events and alert users. More information is provided below. 


# Block submission
Only the operator can submit blocks. The data submitted is the root of the Merkle tree containing all the transactions in the block. To submit a block, call the following:

```
PlasmaFramework.submitBlock(blockRoot);
```

On success, the PlasmaFramework contract emits a `BlockSubmitted` event:

```
event BlockSubmitted(
    uint256 blockNumber
);  
``` 

 > ***Note**: For more information about parameter types, return types, valid values, and so on, see the [Plasma Contract API documentation](../contracts/BlockController.md#submitblock).*
 


# Transactions
Transactions are composed of inputs and outputs. An input is simply a pointer to the output of another transaction. 

Transactions included in a block have a position, which is the number of the block it's in, and its index in that block. For example, the fourth transaction in block number 5000 has this position: `(5000, 3)`

To determine the position of the outputs of a transaction, you will include the index of the output in the transaction. So, the position of the second output of the transaction, in the example above, would be: `(5000, 3, 1)`



## Transaction type and output type

ALD introduces the concepts of transaction type, and transcation output type. Each transaction type and transcation output type can define different rules about how to spend funds.



## Transaction format
Transactions follow the [Wire Transaction format](https://docs.google.com/document/d/1ETAO5ZUO7S_A8sXUK5cyAN6yMMotRDbJphAa2hPJIyU/edit).

Briefly, this is:

```
transaction::= transactionType [input] [output] metadata [witness]
```

Where 
```
transactionType::= uint256
input ::= outputId | outputPosition
outputId ::= hash of the transaction that produced the output concatenated with the outputIndex
outputPosition ::= 32 byte string that is (blockNumber * BLOCK_OFFSET + txIndex * TX_OFFSET + outputIndex)
output ::= outputType outputGuard token amount
outputType ::= uint256
outputGuard ::= bytes20
token ::= address
amount ::= uint256
witness ::= bytes
```

 > ***Note**: Currently, the PlasmaFramework contract only partially follows the proposed Wire Transaction format; output type is implemented as `outputType outputGuard token amount` instead of `outputType outputGuard token vaultId standardSpecificData confirmAddress`.*

The current implementation supports only the following transaction types:  `Payment` and `DEX` 

Support for additional transaction types, such as ERC721, is reserved for future development.



## Deposit transactions
Deposit transactions are special transactions that have no inputs. The transaction inputs should be encoded as an empty array. Deposit transactions are created by the vault contracts, and do not need to be explicitly submitted.


## EIP-712 signing
The **witness** field of a transaction contains the data that proves its inputs can be spent. For a standard payment transaction, this data is the signatures of the owners of the inputs. Transactions are signed using the [EIP-712](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md) method.

The EIP-712 typed data structure is as follows:
 > ***Important**! This is likely to change in future.*

```
{
  types: {
    EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' }
    ],
    Transaction: [
        { name: 'txType', type: 'uint256' },
        { name: 'input0', type: 'Input' },
        { name: 'input1', type: 'Input' },
        { name: 'input2', type: 'Input' },
        { name: 'input3', type: 'Input' },
        { name: 'output0', type: 'Output' },
        { name: 'output1', type: 'Output' },
        { name: 'output2', type: 'Output' },
        { name: 'output3', type: 'Output' },
        { name: 'metadata', type: 'bytes32' }
    ],
    Input: [
        { name: 'blknum', type: 'uint256' },
        { name: 'txindex', type: 'uint256' },
        { name: 'oindex', type: 'uint256' }
    ],
    Output: [
        { name: 'outputType', type: 'uint256' },
        { name: 'outputGuard', type: 'bytes20' },
        { name: 'currency', type: 'address' },
        { name: 'amount', type: 'uint256' }
    ]
  },
  domain: {
        name: 'OMG Network',
        version: '1',
        verifyingContract: '',
        salt: '0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83'
    },
  primaryType: 'Transaction'
}
```



# Vaults
Vaults are used to deposit funds and, indirectly, to withdraw funds via the exit game.


## Depositing funds
You must use the appropriate vault to deposit funds from the root chain (Ethereum) into the child chain. For example, to deposit ETH you use the EthVault contract. You can retrieve the address of this contract by calling the following function:

`PlasmaFramework.vaults(1)`

### Depositing ETH
1. Create the RLP-encoded deposit transaction: `depositTx`
2. Call `EthVault.deposit(depositTx)`
3. Along with the transaction, send the amount of ETH specified in the deposit transaction.
4. The ETHVault creates a deposit block, and submits it to the PlasmaFramework.
5. The ETHVault emits the DepositCreated event.
6. The child chain receives the DepositCreated, and creates the corresponding UTXO.
7. The UTXO is spendable by the user after a certain number of blocks are submitted to the PlasmaFramework (specified in `deposit_finality_margin`).



### Depositing ERC20 tokens

1. To transfer the amount of tokens you wish to deposit, approve the ERC20Vault contract.
2. Create the RLP-encoded deposit transaction: `depositTx`
3. Call `ERC20Vault.deposit(depositTx)`.
4. The ERCVault calls `ERC20.transferFrom()` to transfer the tokens to itself.
5. The ERC20Vault creates a deposit block, and submits it to the PlasmaFramework.
6. The ERC20Vault emits the `DepositCreated` event.
7. The child chain receives the `DepositCreated`, and creates the corresponding UTXO.
8. The UTXO is spendable by the user after a certain number of blocks are submitted to the PlasmaFramework (specified in `deposit_finality_margin`).



## Vault events
Vaults emit events on deposit, and on withdrawal.

Events emitted on deposit:

```
    event DepositCreated(
        address indexed depositor,
        uint256 indexed blknum,
        address indexed token,
        uint256 amount
    );
```

Events emitted on withdrawal:
```
    event Erc20Withdrawn(
        address payable indexed receiver,
        address indexed token,
        uint256 amount
    );
```


# Exit Game
Exit Games handle all the actions around exits, challenges, etc.


## Exit game bonds
Exit games are associated with various bonds. The values of these bonds may change over time. The current value of a bond can be retrieved from the PlasmaFramework contract.


### Standard exit bond
A standard exit bond is used to start a standard exit:

```
    PlasmaFramework.startStandardExitBondSize()
```

### In-flight exit bonds

There are two types of in-flight exit bonds:

- In-flight exit bond for starting an in-flight exit
```
    PlasmaFramework.startIFEBondSize()()
```
- In-flight exit bond for piggybacking on an in-flight exit's input or output:
```
    PlasmaFramework.piggybackBondSize()()
```


## Playing the exit game

### Starting a standard exit

To start a standard exit, perform these steps:

1. To exit a UTXO you need to retrieve the corresponding transaction type. Currently, the platform supports only payment transactions, for which the ID is 1.

2. Now retrieve the exit game contract address from the PlasmaFramework contract:  

```
address = PlasmaFramework.exitGames(1)
PaymentExitGame = PaymetExitGame.at(address);
```

3. To start a standard exit, send the appropriate amount of ETH to cover the bond. To retrieve the actual amount, call the following function:

```
PaymentExitGame.startStandardExitBondSize()
```

```
PaymentExitGame.startStandardExit({
  utxoPos,
  rlpOutputTx,
  outputGuardPreimage
  outputTxInclusionProof,
})
```

### Parameters
This section describes the parameters in the function for starting a standard exit.

#### utxoPos (uint192)
The position of the exiting output. The formula is as follows:

```
block number * the block offset (defaults: `1000000000`) + transaction position * transaction offset (defaults to `10000`) + the index of the UTXO in the list of outputs of the transaction
```

For example, if we have a deposit transaction in block 160000 at index 0, and we want the utxoPos of the output at index 0 (deposit transactions only have one output, and no inputs):

```
160000 * 10000 + 0 * 10000 + 0 = 1600000000
```

#### rlpOutputTx (bytes)
The RLP-encoded transaction that creates the exiting output. 

This example is a deposit transaction of 1,000,000,000,000,000 Wei, sent from address `0xa013debd703e28af78c2ffd0264ef70f978c5465`, to the `EthVault` contract:

```
[
  1, # Transaction type, 1 for Payment
  [], # inputs, empty for deposit transactions
  [ # list of outputs, only one for deposit transactions
    [
      1, # transaction output type, 1 for payment transaction output
      # owner of the output, for deposit txs, owner = sender
      "0xa013debd703e28af78c2ffd0264ef70f978c5465",

      # The currency, 0x0000000000000000000000000000000000000000 = ether
      "0x0000000000000000000000000000000000000000", 

      # The amount to deposit
      1000000000000000
    ]
  ],
  # metadata, in this case, no metadata are sent
  "0x0000000000000000000000000000000000000000000000000000000000000000"
]
```

This transaction must be RLP-encoded, using a library of your choice. Before RLP-encoding, ensure you decode the owner address, currency and metadata, from hexadecimal to bytes. Once the transaction is RLP-encoded, encode the result to hexadecimal.


#### outputGuardPreimage (bytes)
(Optional) The output guard preimage data. Send an empty bytes value. Example with Remix: `[]`

 > ***Note**: `outputGuardPreimage` is currently reserved for future development.*

#### outputTxInclusionProof (bytes)
A Merkle proof showing that the transaction was included. This Merkle proof, which is used to prove the inclusion of a specific hash in a Merkle tree, is a string containing each sibling hash for each level of the Merkle tree, concatenated together.

 > ***Note**: To learn more about Merkle tree implementation, see [Basic Merkle Tree understanding](https://en.wikipedia.org/wiki/Merkle_tree)
[Implementation example](https://github.com/omisego/plasma-contracts/blob/master/plasma_framework/test/helpers/merkle.js)*

### Troubleshooting
If starting the standard exit fails with an error that refers to a missing queue, use the following function to check that the exit queue is registered for the given vault ID and token:


```
PlasmaFramework.hasExitQueue(vaultId, tokenAddress)
```

If no exit queue is registered, you’ll need to register it using the following function:
```
PlasmaFramework.addExitQueue(vaultId, tokenAddress)
```

#### Example:

```
PaymentExitGame.startStandardExit([
  1600000000,
  0xf85801c0f4f3019441777dc7bdcc6b58be1c25eb3df7df52d1bfecbd94000000000000000000000000000000000000000087038d7ea4c68000a00000000000000000000000000000000000000000000000000000000000000000,
  [],
  0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563633dc4d7da7256660a892f8f1604a44b5432649cc8ec5cb3ced4c4e6ac94dd1d890740a8eb06ce9be422cb8da5cdafc2b58c0a5e24036c578de2a433c828ff7d3b8ec09e026fdc305365dfc94e189a81b38c7597b3d941c279f042e8206e0bd8ecd50eee38e386bd62be9bedb990706951b65fe053bd9d8a521af753d139e2dadefff6d330bb5403f63b14f33b578274160de3a50df4efecf0e0db73bcdd3da5617bdd11f7c0a11f49db22f629387a12da7596f9d1704d7465177c63d88ec7d7292c23a9aa1d8bea7e2435e555a4a60e379a5a35f3f452bae60121073fb6eeade1cea92ed99acdcb045a6726b2f87107e8a61620a232cf4d7d5b5766b3952e107ad66c0a68c72cb89e4fb4303841966e4062a76ab97451e3b9fb526a5ceb7f82e026cc5a4aed3c22a58cbd3d2ac754c9352c5436f638042dca99034e836365163d04cffd8b46a874edf5cfae63077de85f849a660426697b06a829c70dd1409cad676aa337a485e4728a0b240d92b3ef7b3c372d06d189322bfd5f61f1e7203ea2fca4a49658f9fab7aa63289c91b7c7b6c832a6d0e69334ff5b0a3483d09dab4ebfd9cd7bca2505f7bef59cc1c12ecc708fff26ae4af19abe852afe9e20c8622def10d13dd169f550f578bda343d9717a138562e0093b380a1120789d53cf10,
])
```

### Challenging a standard exit
To challenge an exit, retrieve payment exit game as in [step 2 for starting a standard exit](#starting-a-standard-exit).

Then obtain `exitId` (if you don’t yet have it):

```
PaymentExitGame.getStandardExitId(
  true, # true if deposit, false else
  "0xf85801c0f4f3019441777dc7bdcc6b58be1c25eb3df7df52d1bfecbd94000000000000000000000000000000000000000087038d7ea4c68000a00000000000000000000000000000000000000000000000000000000000000000", # RLP-encoded transaction sent when startStandardExit was called
  1600000000, # utxoPos
)
``` 

Once you have the exit game and `exitId`, call `challengeStandardExit`:

```
PaymentExitGame.challengeStandardExit({
  exitId,
  exitingTx,
  challengeTx,
  inputIndex,
  witness,
  spendingConditionOptionalArgs,
  outputGuardPreimage,
  challengeTxPos,
  challengeTxInclusionProof,
  challengeTxConfirmSig,
});
```

### Parameters
This section describes arguments provided to `PaymentExitGame.challengeStandardExit` 

#### exitId (uint160)
Identifier of the exit to challenge.

#### exitingTx (bytes)
RLP-encoded transaction that created the exiting output.

#### challengeTx (bytes)
RLP-encoded transaction that spends the exiting output (challenging transaction).

#### inputIndex (uint16)
Input index of exiting UTXO in the challenging transaction.

#### witness (bytes)
Data proving that exiting output was spent. A signature of exiting output owner on challenging transaction.

#### spendingConditionOptionalArgs (bytes)
(Optional) Additional data that is used to verify that output was spent. Send empty bytes.

> ***Note**: `spendingConditionOptionalArgs` is currently reserved for future development.*

#### outputGuardPreimage (bytes)
(Optional) Output guard preimage data for the exiting output. For payment exit game send empty bytes.

> ***Note**: `outputGuardPreimage` is currently reserved for future development.*

#### challengeTxPos (uint256)
(Optional) Transaction position of challenging transaction. Transaction position is

```
block number * the block offset (defaults: `1000000000`) + transaction position * transaction offset (defaults to `10000`)
```
Provide value zero when exiting a payment transaction.

> ***Note**: `challengeTxPos` is currently reserved for future development.*

#### challengeTxInclusionProof (bytes)
(Optional) Inclusion proof for a challenging transaction that follows MVP protocol. For MoreVP send empty bytes.

> ***Note**: `challengeTxInclusionProof` is currently reserved for future development.*

#### challengeTxConfirmSig (bytes)
(Optional) Confirmation signature for a challenging transaction that follows MVP protocol. For MoreVP send empty bytes.

> ***Note**: `challengeTxConfirmSig` is currently reserved for future development.*

#### Example:

```
PaymentExitGame.challengeStandardExit([
  1590417156246506823621774965204183050418265227,
  0xf85401c0f0ef01949c7fc8601655b4e1ef395107217e6ed600f7ba48940000000000000000000000000000000000000000830f4240a00000000000000000000000000000000000000000000000000000000000000000,
  0xf88a01c685e9103fda00f85fee0194821aea9a577a9b44299b9c15c88cf3087f3b55449400000000000000000000000000000000000000008203e8ef01949c7fc8601655b4e1ef395107217e6ed600f7ba48940000000000000000000000000000000000000000830f3e58a00000000000000000000000000000000000000000000000000000000000000000,
  0,
  0xc8fafc7490868b372863778cd2c7928c835e66c59d7bc44b912d14ca574732434f928004b680d9a231c3a688fe1c1f62bac47c663695c8287d779ff2658626c81b,
  0x,
  0x,
  0,
  0x,
  0x
])
```

### Processing a standard exit

Once the exit period is over, an exit can be processed to release the funds on the root chain. An end user can perform this action, or the operator can do it for everyone.

To process a standard exit: 
1. Obtain your `exitId` as described [here](#challenging-a-standard-exit)

2. Process your exit. 

```
PlasmaFramework.processExits({
  uint256 vaultId, 
  address token, 
  uint160 topExitId, 
  uint256 maxExitsToProcess
})
```

### Parameters
This section describes the parameters included in the function called for processing a standard exit.

#### vaultId (uint256)
The vault ID of the vault that stores exiting funds.

Use `1` for Ether, `2` for ERC-20.

#### token (address)
The token type to process.

ETH: `0x0000000000000000000000000000000000000000` 

The contract address for ERC-20 tokens.

#### topExitId (uint160)
The unique priority of the first exit that should be processed. Set to zero to skip the check.

If you're trying to process only your own exit, set your exitId here.

#### maxExitsToProcess (uint256)
Defines the maximum number of exits you wish to process. Set to `1` to process only your own exit. 


### Example: Processing a standard exit

```
PlasmaFramework.processExits([
  1, # vaultId 
  0x0000000000000000000000000000000000000000, # token, ETH
  707372774235521271159305957085057710072500938, # topExitId
  1 # maxExitsToProcess
])
```

**TODO:** Starting an In-flight Exit

**TODO:** Piggybacking on an In-flight Exit

**TODO:** Challenging an In-flight Exit as non-canonical 

**TODO:** Responding to an In-flight Exit non-canonical challenge 

**TODO:** Challenging an In-flight Exit input spent 

**TODO:** Challenging an In-flight Exit output spent 


## Exit game events
When listening for events related to the exit game, it's important to remember that there will be only one exit game per transaction type.


### Standard Exit Events
- A standard exit has started:
```
   event ExitStarted(
        address indexed owner,
        uint160 exitId
    );
```
- A standard exit is successfully challenged:
```
    event ExitChallenged(
        uint256 indexed utxoPos
    );
```
- An exit is successfully processed; that is, funds sent back to owner:
```
    event ExitFinalized(
        uint160 indexed exitId
    );
```
- An exit was in the exit queue but was not processed; for example, because it was already processed:
```
    event ExitOmitted(
        uint160 indexed exitId
    );
```

### In-flight exit events
This section describes the events for an in-flight exit.


- An in-flight exit has started:
```
    event InFlightExitStarted(
        address indexed initiator,
        bytes32 indexed txHash
    );
```
- An input has been piggybacked on an in-flight exit:
```
    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 indexed txHash,
        uint16 inputIndex
    );
```
- An output has been piggybacked on an in-flight exit:
```
    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 indexed txHash,
        uint16 outputIndex
    );
```
- An in-flight exit has been successfully challenged as non-canonical:
```
    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 indexed txHash,
        uint256 challengeTxPosition
    );
```
- An in-flight exit has been proved canonical in response to a non-canonical challenge:
```
    event InFlightExitChallengeResponded(
        address indexed challenger,
        bytes32 indexed txHash,
        uint256 challengeTxPosition
    );
```
- A piggybacked input on an in-flight exit has been shown to have been spent:
```
    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 indexed txHash,
        uint16 inputIndex
    );
```
- A piggybacked output on an in-flight exit has been shown to have been spent:
```
    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 indexed txHash,
        uint16 inputIndex
    );
```
- A piggybacked input on an in-flight exit has been successfully withdrawn; that is, funds sent back to owner:
```
    event InFlightExitInputWithdrawn(
        uint160 indexed exitId,
        uint16 inputIndex
    );
```
- A piggybacked output on an in-flight exit has been successfully withdrawn; that is, funds sent back to owner:
```
    event InFlightExitOutputWithdrawn(
        uint160 indexed exitId,
        uint16 outputIndex
    );
```
- An exit was in the exit queue, but was not processed; for example, because it was already processed:
```
    event InFlightExitOmitted(
        uint160 indexed exitId,
        address token
    );
```

# Upgrading the PlasmaFramework
The PlasmaFramework is designed to be upgraded, either to fix bugs, or to add new functionality. Upgrades are done by adding new contracts to the framework. Any upgrade takes some time to come into effect. This keeps the framework trustless; that is, if a new malicious or vulnerable contract is added, users have an opportunity to exit before the problematic contract is activated.


## Upgrade the deposit transaction type of a vault
In the current implementation, a vault comes with a single transaction type, which it accepts to be the deposit transaction. However, as time goes, we might want to use as the deposit transaction, the later version of transaction type or a completely new transaction type. For instance, the ETH vault and ERC20 vault accepts payment transaction as the deposit transaction. 

 > ***Note**: In future, when a new payment transaction type is available, it will be changed to payment transaction v2.*

The vault is designed with the concept of `depositVerifier`. This is a predicate contract with the ability to check whether a deposit transaction is the right transaction type, with the data required for a deposit. As a result, to upgrade to new deposit transaction type, it is necessary to implement the new `depositVerifier` contract and set the new verifier to the vault.

### Configure a new deposit verifier
1. Implement new deposit verifier that fullfils the interface of the certain vault.
   
   For details on the deposit verifier code and interface, see the documentation, [here](https://github.com/omisego/plasma-contracts/tree/master/plasma_framework/contracts/src/vaults/verifiers)

2. Call the `setDepositVerifier` function by `maintainer`.

   For more information, see [setDepositVerifier doc](https://github.com/omisego/plasma-contracts/blob/master/plasma_framework/docs/contracts/Vault.md#setdepositverifier). 

3. After the call, you should recieve the `setDepositVerifierCalled` event: 

    ```
    event SetDepositVerifierCalled(address  nextDepositVerifier);
    ```
4. Wait **two** `minExitPeriod` for the new deposit verifier to take effect. In production, it should be two weeks.


### Security analysis

The waiting period of two weeks when upgrading the deposit verifier provides protection for deposit transactions that are sent on the root chain, but are still in mempool before the `setDepositVerifier` is called. Also, it gives a one week buffer for the user to perform a standard exit if an invalid deposit verifier is set.

For more information, see the description in the following issues: 
- https://github.com/omisego/plasma-contracts/issues/174
- https://github.com/omisego/plasma-contracts/issues/412

Users/watchers should listen to the following event to understand when the new deposit verifier takes effect: `setDepositVerifierCalled`

In case the new deposit verifier is not trustworthy, immediately stop any deposit action to the vault, and exit all outputs from the PlasmaFramework.


## Add a new vault
Although it's possible to upgrade the deposit transaction type of a vault, one vault supports only one ERC protocol. For this reason, a new vault must be added if support is required for a new ERC protocol. 

Additionally, if the existing vault code contains any bugs, a new vault is required to replace it. 

 > ***Important**! The process of moving funds from one vault to another is relatively complex, involving a full exit and re-deposit, and should be done with caution.* 

Perform these steps to add a new vault:

1. Design and implement a new vault contract. 

  Unless some feature breaks the abstraction, otherwise please inheritence the existing abstract vault contract. For more     
  information, see: [Vault.sol](https://github.com/omisego/plasma-            contracts/blob/master/plasma_framework/contracts/src/vaults/Vault.sol)

2. The maintainer registers the new vault to the PlasmaFramework, using the following function: `registerVault` 

   For more information, see the documentation, [here](https://github.com/omisego/plasma-contracts/blob/master/plasma_framework/docs/contracts/VaultRegistry.md#registervault).

3. Wait for the following event to be returned: `event VaultRegistered(uint256  vaultId, address  vaultAddress);`

5. Wait **two** `minExitPeriod` (two weeks in production). 

6. After the waiting period completes, the user is able to deposit to the new vault.

### Security analysis
As with the process of configuring a new deposit verifier, a period of two weeks waiting time is chosen to protect the deposit transactions that are still in the mempool when the transaction of `registerVault` is sent. Also, it gives a one week buffer for the user to perform a standard exit if an invalid deposit verifier is set.

For more information, see the description in the following issues: 
- https://github.com/omisego/plasma-contracts/issues/173
- https://github.com/omisego/plasma-contracts/issues/412

Users/watchers should listen to the follwing event to understand when the new vault is registered: `VaultRegistered`

In case the new vault is not truthworthy, do not perform any deposit to the new vault, and exit all outputs from the PlasmaFramework.


## Add a new exit game
Adding a new exit game is the main method for adding new features to the PlasmaFramework. 

For each transaction type, there is a corresponding exit game. This means that when a feature is added, a new transaction type is also added, and the new transaction type is registered to the corresponding exit game contract in the PlasmaFramework contract.

For example, to support a new DEX feature, a new DEX transaction may be added for spending a payment transaction.

Perform these steps to add a new exit game: 
1. Design a new transaction type and implement the exit game.
2. The maintainer registers the new exit game contract to the PlasmaFramework, using the following function:  `registerExitGame` 

 For more information, see the [documentation](https://github.com/omisego/plasma-contracts/blob/389_add_priority_queue_test/plasma_framework/docs/contracts/ExitGameRegistry.md#registerexitgame)

3. The following event is returned: `event ExitGameRegistered(uint256  txType, address  exitGameAddress, uint8  protocol);`

4. Wait **three** `minExitPeriod` (three weeks in production) for the new exit game to take effect.


### Security analysis
A waiting time is required when adding a new exit game. This provides protection for existing users, since the exit game contract has access to several components in the PlasmaFramework. For example, the exit game can insert an exit with the wrong order, flag a random output as used, or ask the vault to withdraw funds directly. For this reason, it has been determined that a minimum period of three weeks is required before allowing any new exit game contracts to take effect. 

**Why a three week waiting period?** 

The three week period is determined as follows:
* It takes two weeks for a newly mined transaction to exit once a mass exit scenario is detected; thus, `mined_block_time + 2 weeks`; or, two weeks after it's mined.
* One extra week provides users with an opportunity to clean up the exit queue (`processExits`) before a bad exit game contract can potentially insert a bad exit, with the wrong priority.

For details, see this issue: https://github.com/omisego/plasma-contracts/issues/172

Users/Watchers should listen to the following event to be alerted about a new exit game: `ExitGameRegistered`

If new exit game contract is not trustworthy, it is important to exit immediately.


# Ensuring the correctness of the Plasma network
Plasma is designed to be somewhat optimistic; that is, it assumes everything is correct unless proven otherwise. 

Exit games allow users to participate in ensuring the correctness of the system. However, there must be a way to alert users so they know when to engage in the exit games. This role is performed by the Watchers. 


## Watchers
Watchers monitor the network and send alerts so that users know when they need to react to events.

**TODO: Description of all events that a Watcher should listen for, and how the user should react**
