# Introduction
This document attempts to collate all of the information necessary to interact with the Plasma ALD framework. For more detailed information on the concepts involved, see the following documents:

- [High level design of the Plasma Abstract Layer](https://docs.google.com/document/d/1PSxLnMskjqje4MksmW2msSSg-GtZoBSMNYey9nEDvt8)
- [Tesuji Plasma Blockchain Design](https://github.com/omisego/elixir-omg/blob/master/docs/tesuji_blockchain_design.md)
- [Solidity contract documentation](https://github.com/omisego/plasma-contracts/blob/master/plasma_framework/docs/PlasmaFramework.md)

# PlasmaFramework
The PlasmaFramework contract can be seen as the top-level contract that contains many of the other components described below:
- BlockController
- ExitGameController
- ExitGameRegistry
- VaultRegistry

It provides access to the various components in the system. For example, to get the Payment ExitGame you should call `PlasmaFramework.exitGames(PaymentType)`.

The PlasmaFramework also provides the means for the `maintainer` to upgrade the components in the system. This has important security considerations and the PlasmaFramework will emit events whenever a component is added. Watcher must monitor these events and inform users. See later for details.

# Block submission
Only the operator can submit blocks. The data submitted is the root of the merkle tree containing all the transactions in the block. To submit a block, call
```
PlasmaFramework.submitBlock(blockRoot);
```
On success emits a `BlockSubmitted` event
```
event BlockSubmitted(
    uint256 blockNumber
);  
``` 
[See contract docs](../contracts/BlockController.md#submitblock)

# Transactions
Transactions are composed of inputs and outputs. An input is simply a pointer to the output of another transaction. 

Transactions that have been included in a block have a position which is the number of the block it's in and its index in that block. For example the fourth transaction in block 5000 has a position of `(5000, 3)`.

The position of the outputs of a transaction can be obtained by including the index of the output in the transaction. So the position of the second output of the transaction in the above example would be `(5000, 3, 1)`.

## Transaction type and output type

The Abstract Layer Design introduces the concept of Transaction Type and Transcation Output Type. Each Transaction Type and Transcation Output Type can define different rules about how to spend funds.

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

Note that currently we don't fully follow the proposed Wire Transaction format - our implementation of output type is `outputType outputGuard token amount` instead of `outputType outputGuard token vaultId standardSpecificData confirmAddress`.

The current implementation only supports `Payment` and `DEX` transaction types.
We will need to change this when we introduce new transaction types, e.g. ERC721

## Deposit transactions
Deposit transactions are special transactions that have no inputs. Note that this should be encoded as an empty array. Deposit transactions are created by the Vault contracts and do not need to be explicitly submitted.

## EIP-712 signing
The witness field of a transaction is the data that proves its inputs can be spent. For a normal Payment transaction this data is the signatures of the owners of the inputs. We use [EIP-712](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md) for signing transactions.

The EIP-712 typed data structure is as follows:
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

**Note that this is likely to change in the future!**


# Vaults
Vaults are used to deposit funds and indirectly to withdraw funds via the Exit Game.

## Depositing funds
To deposit funds from the root chain (Ethereum) into the child chain, you must use the approriate Vault. For example to deposit ETH you use the EthVault contract. The address of this contract can be retrieved by calling `PlasmaFramework.vaults(1)`

### Depositing ETH
1. The user creates the RLP encoded deposit transaction, `depositTx`
2. The user calls `EthVault.deposit(depositTx)`. The user must send with the transaction the amount of ETH specified in the deposit transaction.
3. The ETHVault creates a Deposit Block and submits it to the PlasmaFramework
4. The ETHVault emits the `DepositCreated` event
5. The child chain receives the `DepositCreated` and creates the corresponding utxo
6. After a certain amount of blocks (`deposit_finality_margin`) the utxo is spendable by the user.

### Depositing ERC20 tokens
1. The user approves the ERC20Vault contract to transfer the amount of tokens to be deposited.
2. The user creates the RLP encoded deposit transaction, `depositTx`
3. The user calls `ERC20Vault.deposit(depositTx)`.
4. The ERCVault calls `ERC20.transferFrom()` to transfer the tokens to itself.
5. The ERC20Vault creates a Deposit Block and submits it to the PlasmaFramework
6. The ERC20Vault emits the `DepositCreated` event
7. The child chain receives the `DepositCreated` and creates the corresponding utxo
8. After a certain amount of blocks (`deposit_finality_margin`) the utxo is spendable.

## Vault events
Vaults emit events on deposit:
```
    event DepositCreated(
        address indexed depositor,
        uint256 indexed blknum,
        address indexed token,
        uint256 amount
    );
```
and on withdrawal:
```
    event Erc20Withdrawn(
        address payable indexed receiver,
        address indexed token,
        uint256 amount
    );
```


# Exit Game
Exit Games handle all the actions around exits, challenges, etc.

## Exit Game Bonds
There are various bonds involved with Exit Games. These values of these bonds may change over time, the current value of a bond can be retrieved from the PlasmaFramework contract.

### Standard Exit Bond
- Bond for starting a Standard Exit.
```
    PlasmaFramework.startStandardExitBondSize()
```

### In-flight Exit Bonds
- Bond for starting an In-flight Exit.
```
    PlasmaFramework.startIFEBondSize()()
```
- Bond for piggybacking on an In-flight Exit's input or output.
```
    PlasmaFramework.piggybackBondSize()()
```

## Playing the Exit Game

**TODO:** Starting a Standard Exit

**TODO:** Challenging a Standard Exit

**TODO:** Processing Exits

**TODO:** Starting an In-flight Exit

**TODO:** Piggybacking on an In-flight Exit

**TODO:** Challenging an In-flight Exit as non-canonical 

**TODO:** Responding to an In-flight Exit non-canonical challenge 

**TODO:** Challenging an In-flight Exit input spent 

**TODO:** Challenging an In-flight Exit output spent 


## Exit Game Events
When listening for Exit Game related events, it's important to remember that there will be one Exit Game per transaction type.

### Standard Exit Events
- When a standard exit is started.
```
   event ExitStarted(
        address indexed owner,
        uint160 exitId
    );
```
- When a standard exit is successfully challenged.
```
    event ExitChallenged(
        uint256 indexed utxoPos
    );
```
- When an exit is successfully processed (i.e. funds sent back to owner)
```
    event ExitFinalized(
        uint160 indexed exitId
    );
```
- When an exit was in the exit queue but was not processed (e.g. because it was already processed).
```
    event ExitOmitted(
        uint160 indexed exitId
    );
```

### In-flight Exit Events

- When an In-flight Exit has been started.
```
    event InFlightExitStarted(
        address indexed initiator,
        bytes32 txHash
    );
```
- When an input has been piggybacked on an In-flight Exit.
```
    event InFlightExitInputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 inputIndex
    );
```
- When an input has been piggybacked on an In-flight Exit.
```
    event InFlightExitOutputPiggybacked(
        address indexed exitTarget,
        bytes32 txHash,
        uint16 outputIndex
    );
```
- When an In-flight Exit has been successfully challenged as non-canonical.
```
    event InFlightExitChallenged(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );
```
- When an In-flight Exit has been proved canonical in response to a non-canonical challenge.
```
    event InFlightExitChallengeResponded(
        address indexed challenger,
        bytes32 txHash,
        uint256 challengeTxPosition
    );
```
- When a piggybacked input on an In-flight Exit has been shown to have been spent
```
    event InFlightExitInputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint16 inputIndex
    );
```
- When a piggybacked output on an In-flight Exit has been shown to have been spent
```
    event InFlightExitOutputBlocked(
        address indexed challenger,
        bytes32 txHash,
        uint16 inputIndex
    );
```
- When a piggybacked input on an In-flight Exit has been successfully withdrawn (i.e. funds sent back to owner)
```
    event InFlightExitInputWithdrawn(
        uint160 indexed exitId,
        uint16 inputIndex
    );
```
- When a piggybacked output on an In-flight Exit has been successfully withdrawn (i.e. funds sent back to owner)
```
    event InFlightExitOutputWithdrawn(
        uint160 indexed exitId,
        uint16 outputIndex
    );
```
- When an exit was in the exit queue but was not processed (e.g. because it was already processed).
```
    event InFlightExitOmitted(
        uint160 indexed exitId,
        address token
    );
```

# Upgrading the Framework
The framework is designed to be upgraded, either to fix bugs or add new functionality. Upgrades are done by adding new contracts to the framework. Any upgrade will take a certain period of time to come into effect. This is to keep the framework trustless - if a new contract is added that is malicious or vulnerable, then users will have a chance to exit before it is activated.

**TODO: Upgrades and security**


# Ensuring the correctness of the Plasma network
Plasma is designed to be somewhat optimistic - it assumes everything is correct unless proven otherwise. Users play their part in ensuring the correctness of the system by means of the Exit Games, as described in the previous section. However, it there needs to be a way to let the users know when they need to engage in the Exit Games. This is where the Watchers come in.


## Watchers
It is the role of the Watchers to monitor the network and alert users as to when they need to react to events.

**TODO: Description of all events that a Watcher should listen for, and how the user should react**
