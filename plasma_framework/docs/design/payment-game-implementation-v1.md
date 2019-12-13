# Payment ExitGame Implementation V1

This document is a short description of the interactions in the current Payment ExitGame implementation. Check the [ALD ExitGame definitions and properties doc](./ald-exit-game-definitions-and-properties.md) for more background on the terminologies used in this document.

Payment transaction V1 is specified such that it allows to have Payment transaction V1 and Fee transaction as input and have both Payment transaction V1 and V2 as outputs. Specification of V2 is still undefined and a place holder at the moment. However, the spending condition of V1 to V2 is fulfilled if the output owner correctly signs the spending transaction.

## Transaction Data Structure


```
struct Transaction {
    uint256 txType;
    bytes32[] inputs;
    Output[] outputs;
    uint256 txData;
    bytes32 metaData;
}

struct Output {
    uint256 outputType;
    bytes20 outputGuard;
    address token;
    uint256 amount;
}
```

`Transaction` is the top level structure and it has the following fields:
1. `txType` is a unique number that represents the type of transaction. Each transaction type has only one exit game contract associated with it. 
1. The `inputs` field is an array of `bytes32` representing the `utxoPos` as the output identifier. There are a maximum four inputs allowed. An input can not be `0x0` if it is specified `inputs` list. 
1. The `outputs` field is an array of `Output` struct representing payment output information. There are a maximum of four outputs allowed. 
2. `txData` is unused and must be `0`.
3. `metaData` field is a `bytes32` field that can be used to add extra data to the transaction. It should contain `0x0` if the transaction does not have extra data.

Output has four elements that fulfil the current `FungibleTokenOutputModel.Output`:
1. `outputType` represents the type of output. Each transaction type is tied to one or more output types. In Payment transaction V1, there is only one output type. The output type is used to decide, eg. which spending condition to use. Also, output type is bound to the input type. Currently the only output type that requires the spending tx's input to be using `utxoPos`. Potentially there can be output type deciding to be pointed by `outputId` instead in the future.
1. `outputGuard` is the field that represents the authentication data of the output. Its value must always be the same as the `owner` address of the output in the first version of Payment Transaction. For instance, if the output belongs to Alice, then the value of `outputGuard` equals Alice's address.
1. `token` is the ERC20 token contract address that represents the transferred asset. For `ETH`, it uses `address(0)`.
1. `amount` defines how many units of the asset are being transferred.

A `Transaction` can be further grouped into two different sub categories. They both fit into the above specification of a `Transaction` but they are both unique in how many inputs and outputs they allow and how they are processed by the different components in the Plasma Framework system. 

1. A `Standard Tx` has between one and four inputs and one and four outputs. It can only be created by the operator who holds the authority key. 

1. A `Deposit Tx` has zero inputs and one output. It is a special transaction that can only be created by the root chain contracts when a deposit occurs. They are also distinguishable from a `Standard Tx` by the fact that they are included in deposit blocks, that only contains one `Deposit Tx` per block. 


## Exit Game Properties of Payment Transaction V1

### Spending Condition
There are three spending conditions: Payment V1 -> Payment V1, Fee -> Payment V1, and Payment V1 -> Payment V2. All of them more or less share the same main logic which is to verify that the signature of the output owner matches.

### Valid Spending Tx
Since Payment V1 only have input of output txs with MoreVP protocol, also, spending condition of fee tx is similar with payment tx. As a result, they are with more or less the same logic:

1. Needs to be protocol finalized: tx is protocol finalized as long as the tx exists (MoreVP protocol).
1. Fulfils the spending condition of the input: Checks the signature of the output owner.

### State Transition
A valid state transition of Payment transaction V1 basically checks whether there is no money printed within the transaction. So for each `token`, it should make sure that `sum of inputs >= sum of outputs`. The implicit difference of the sum would be consider the fee to the operator.

### Standard exitable
For a Payment transaction to be exitable on standard exit, it only needs to check whether the tx is in a plasma block or not (standard finalized), and the exiting output is part of the payment tx as specified.

### In-flight exitable
1. All inputs of the exiting tx should be standard finalized. Since Payment tx v1 only accepts MoreVP protocol txs as inputs, it means that all input txs should be included in a plasma block
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
1. Checks the standard exit is valid or not. If not valid, omit to process the exit
1. Checks the output is withdrawable or not
1. Flags the output as finalized
1. Delete the SE data

## In-flight Exit

### Start In-flight exit
1. Checks whether the in-flight tx is exitable
1. Saves the exit data to storage of Exit Game contract

### Piggyback In-flight Exit
1. Checks whether the input/output is one of the input/output of the exiting tx
1. If it is the first piggyback of a certain token, put the exit into the priority queue of that token.
1. Flags the certain input/output as piggybacked

### Challenge In-flight Exit non-canonical:
1. Shows that there exists a protocol finalized competing tx. In Payment V1, since it only needs to consider Payment V1 and V2, as long as competing tx exists, it is protocol finalized
1. Flags the IFE as non-canonical

### Respond non-canonical challenge:
1. Proves that the in-fight tx actually has higher priority than the best competing tx. Uses inclusion proof to prove the position of the transaction and compare it with the best competing tx.
1. Flags the IFE as canonical back

### Challenge piggybacked input/output
1. Shows there exists valid spending tx of the input/output
1. Removes the piggybacked flag of the challenged input or output

### Remove non piggybacked In-flight Exit
1. Checks that the in-flight exit is not in the first half of the exit period
1. Checks that there is no piggyback on the in-flight exit
1. Delete the in-flight exit and transfer IFE bond back to the owner

### Process In-flight exit:
1. Checks whether the in-flight exit is canonical. Canonicity decides whether outputs or inputs are withdrawn. An in-flight exit is considered non-canonical when:
   1. The canonicity games (`challenge in-flight exit non-canonical` and respond `non-canonical challenge`) end up to be non-canonical
   1. Any of the input is already flagged as finalized
1. To be able withdraw:
    - The piggybacked input/output is valid
    - The piggybacked input/output is withdrawable
1. If non-canonical:
    - Flag all processed inputs as finalized
1. If canonical:
    - Flag all inputs as finalized
    - Flag all processed outputs as finalized
1. Deletes the IFE data

As this issue shown: https://github.com/omisego/plasma-contracts/issues/102
The above interactive game implementation has the issue of not able to decide true canonical due to data unavailability from operator. We mitigate this by checking all input of the exiting tx is finalized to make sure no double spending exists. However, this is not a _real_ canonical if we consider the priority of tx can be gamed.
 
