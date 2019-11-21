# Payment ExitGame Implementation V1

This document is a short description of the interaction functions of the current Payment ExitGame implementation. Please check the [ALD ExitGame definitions and properties doc](./ald-exit-game-definitions-and-properties.md) for the description of each specific phrases used in here.

In Payment transaction V1, it only allows to have Payment transaction V1 as inputs and have both Payment transaction V1 and V2 as outputs. Specification of V2 is still undefined. However, the spending condition of V1 to V2 is defined as the signature of output owner should be correctly signed.

## Transaction Data Structure
```
struct Transaction {
    uint256 txType;
    bytes32[] inputs;
    Output[] outputs;
    bytes32 metaData;
}

struct Output {
    uint256 outputType;
    bytes20 outputGuard;
    address token;
    uint256 amount;
}
```

In the first version of the Plasma Framework system, there is only one type of Payment Transaction. 
1. `txType` represents the type of the transaction. Each transaction type has only one exit game contract mapping the exit game interactions. 
1. The `inputs` field is an array of `bytes32` representing the `utxoPos` as the output identifier. There are a maximum four inputs. A deposit transaction does have zero inputs.
1. The `outputs` field is an array of `Output` struct representing payment output information. There are a maximum four outputs.  A deposit transaction does have one output.
1. `metaData` field is a `bytes32` field that can be used to add extra data to the transaction. It should contain zeros if the transaction does not have an extra data.

Output has four elements that fulfills the current `WireTransactionOutput`:
1. `outputType` represents the type of output. Each new valid transaction type is tied to one or more new output types. In Payment transaction V1, there would be only one output type. The output type is used to decide, eg. which spending condition to use. Also, output type is bind to the input type. Currently the only output type requires the spending tx's input to be using `utxoPos`. Potentially there can be output type deciding to be pointed by `outputId` instead in the future.
1. `outputGuard` is the field that represents the authentication data of the output. Its value must always be the same as the `owner` address of the output in the first version of Payment Transaction. For instance, if the output belongs to Alice, then the value of `outputGuard` equals Alice's address.
1. `token` is the ERC20 token contract address that represents the ERC20 token. For `ETH`, it uses `address(0)`.
1. `amount` tells how much of the token is hold within this output

## Exit Game Properties of Payment Transaction V1

### Spending Condition
There are only two spending conditions: Payment V1 -> Payment V1 and Payment V1 -> Payment V2. Both shares the same main logic: Checks the signature of the output owner.

### Valid Spending Tx
Since Payment V1 only have two cases that would be spending it: spending in Payment tx v1 and Payment tx v2, the cases is rather simple as both tx types shares mostly the same logic:

1. Needs to be protocol finalized: Payment tx is protocol finalized if it is included in a Plasma block.
1. Fulfils the spending condition of the input: Checks the signature of the output owner.

### State Transition
A valid state transition of Payment transaction V1 basically checks whether there is no money printed within the transaction. So for each `token`, it should make sure that `sum of inputs >= sum of outputs`. The implicit difference of the sum would be consider the fee to the operator.

### Standard exitable
For a Payment transaction to be exitable on standard exit, it only needs to check whether the tx is in a plasma block or not (standard finalized), and the exiting output is part of the payment tx as specified.

### In-flight exitable
1. All inputs of the exiting tx should be standard finalized. Since Payment tx v1 only accpets Payment tx v1 as inputs, it means that all input txs should be included in a plasma block
1. The state transition of the tx is valid: No money is printed. So `sum of inputs >= sum of outputs` for each token
1. All inputs fulfill the spending condition by checking the signature of input owner with the payment tx
1. The transaction itself is Protocol finalized, which in MoreVP means the payment transaction exists

## Standard Exit

### Start Standard Exit
1. Check standard exit exitable
1. Stores the exit data to Exit Game contract
1. Put the exit into the priority queue

### Challenge Standard Exit
1. Checks the challenging tx is a valid spending tx of the exiting output
1. Delete the exit data of the standard exit

### Process Standard Exit:
1. Checks the standard exit is valid or not
1. Checks the output is withdrawable or not
1. Flags the output as finalized
1. Delete the SE data

## In-flight Exit

### Start In-flight exit
1. Checks if the in-flight tx is exitable:
1. Saves the exit data to storage of Exit Game contract

### Piggyback In-flight Exit
1. Checks the input/output is of the exiting tx
1. If it is the first piggyback, put the exit into the priority queue.
1. Flags the certain input/output as piggybacked

### Challenge In-flight Exit non-canonical:
1. Shows there exists a competing tx
1. Flags the IFE as non-canonical

### Respond non-canonical challenge:
1. Shows the competing tx is of lower priority than the exiting tx
1. Flags the IFE as canonical

### Challenge piggybacked input/output
1. Shows there exists valid spending tx of the input/output
1. Removes the piggybacked flag of the challenged input or output

### Process In-flight exit:
1. Check the in-flight exit is canonical or not
1. None of the inputs is finalized
1. To withdraw:
    - The piggybacked input/output is valid
    - The piggybacked input/output is withdrawable
1. Flag all inputs as finalized
1. Flag all processed output as finalized (if tx is canonical and the output piggybacked)
1. Deletes the IFE data

As this issue shown: https://github.com/omisego/plasma-contracts/issues/102
The above interactive game implementation has the issue of not able to decide true canonical due to data unavailability from operator. We mitigate this by checking all input of the exiting tx is finalized to make sure no double spending exists. However, this is not a _real_ canonical if we consider the priority of tx can be gamed.
 
