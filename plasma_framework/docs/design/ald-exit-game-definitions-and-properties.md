# ALD Exit Game Definitions And Properties

## New definitions from ALD (abstract layer design)
Based on [MoreVP document](https://github.com/omisego/elixir-omg/blob/master/docs/morevp.md). This section adds some new definitions introduced from ALD or give explicit names to some of the implicit characteristics of the origin MoreVP spec.

### SpendingCondition Fulfilled
1. Checks an input tx and the spending tx, whether the spending tx fulfil the requirement of spending the output of input tx or not.
1. Basic checks:
    - Spending tx input points to the output of input tx.
    - Spending tx fulfil the “lock” condition of the output
1. This checks on (at most) tx level, does not check things on Plasma protocol level.

### Tx Standard Finalization
1. MVP:
    - Tx is in a plasma block. (Checks inclusion proof of plasma block)
    - It is confirmed by user. (Checks confirm signature is valid for the inclusion block)
2. MoreVP:
    - Tx is in a plasma block. (Checks inclusion proof of plasma block)

### Tx Protocol Finalized
This is the minimal finalization requirement according to each protocol.

1. MoreVp tx: the transaction exists
2. MVP tx: the transaction is standard finalized

## Exit Properties

### General Properties

#### Valid Spending Tx:
1. Needs to be protocol finalized
1. Fulfils the spending condition of the output

#### Input/Output finalized
1. The input/output has been withdrawn/processed.
1. Or The output has been used as an input of a processed IFE.

#### Input/Output withdrawable
The input/output is not finalized already

### In-flight Exit

#### InFlight exit to be exitable
1. Inputs of the exiting tx should be Standard Finalized (Protocol finalized is not enough)
1. The state transition of the tx is valid
1. All inputs fulfill the spending condition with the exiting tx
1. The transaction itself is Protocol finalized

#### Competing tx
1. Needs to be protocol finalized
1. Fulfils the spending condition of an input of the InFlight exiting tx

#### Canonical tx
1. The tx is exitable
1. No competing tx that has higher or same priority (txPos) then the exiting one. (PS, same priority is for the case both txs are in-flight)
1. All inputs of the tx are not finalized

#### Piggybacked input/output to be valid
1. It is the input or output of the exiting tx
1. There is no other valid spending tx of the piggybacked input/output existing.

#### Spending Tx of a piggybacked input/output to be valid:
1. Needs to be Protocol finalized
1. Fulfils the spending condition of the output that is exiting.

### Standard Exit

#### Standard exit to be exitable
1. The tx of the output is standard finalized
1. The exiting output belongs to the tx it claims

#### Spending Tx to be valid
1. Need to be protocol finalized
1. Fulfil the spending condition of the output that is exiting.

#### Standard exit to be valid
1. There is no valid spending tx of the output existing.

## Current Implementation

### In-flight Exit

#### Start InFlight exit
1. Checks InFlight exitable
1. Saves the exit data to storage of Exit Game contract

#### Piggyback InFlight Exit
1. Checks the input/output is of the exiting tx
1. If it is the first piggyback, put the exit into the priority queue.
1. Flags the certain input/output as piggybacked

#### Challenge InFlight Exit non-canonical:
1. Shows there exists a competing tx
1. Flags the IFE as non-canonical

#### Respond non-canonical challenge:
1. Shows the competing tx is of lower priority than the exiting tx
1. Flags the IFE as canonical

#### Challenge piggybacked input/output
1. Shows there exists valid spending tx of the input/output
1. Removes the piggybacked flag of the challenged input or output

#### Process exit:
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


### Standard Exit

#### Start Standard Exit
1. Check standard exit exitable
1. Stores the exit data to Exit Game contract
1. Put the exit into the priority queue

#### Challenge standard exit
1. Check there exists a spending tx of the exiting output
1. Delete the exit data of the standard exit

#### Process exit:
1. Checks the standard exit is valid or not
1. Checks the output is withdrawable or not
1. Flags the output as finalized
1. Delete the SE data
