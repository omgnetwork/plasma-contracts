# ALD Exit Game Definitions And Properties

## New definitions from ALD (abstract layer design)
Based on [MoreVP document](https://github.com/omisego/elixir-omg/blob/master/docs/morevp.md). This section adds some new definitions introduced from ALD or give explicit names to some of the implicit characteristics of the origin MoreVP spec.

### SpendingCondition Fulfilled
1. Checks an input tx and the spending tx, whether the spending tx fulfil the requirement of spending the output of input tx or not.
1. Basic checks:
    - Spending tx input points to the output of input tx
    - Spending tx fulfil the specific condition to spend the output (similar to the bitcoin lock and unlock script idea, but with spending condition predicates instead)
1. This checks on (at most) tx level, does not check things on Plasma protocol level. For instance, checking signature of a transaction ownership would usually be part of the spending condition. But checking whether the transaction fulfill protocol requirements such as confirmation signature would be out of scope of the responsibility of spending condition.

### State Transition to be valid
1. Checks whether the state transition logic from all inputs to all outputs is valid. For instance, for a Payment transaction it would check that no money is printed (sum of inputs >= sum of outputs).
1. Different from spending condition which checks it is valid to spend an output or not, this checks the transaction itself whether it is fulfilling the specific logic of the transaction type.

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
1. Fulfils the spending condition of the input

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
1. No competing tx that has higher or same priority (txPos) then the exiting one. (PS. same priority is for the case both txs are in-flight)
1. Note that a canonical tx does not check double spending by exit of any inputs. As a result, the exit game should make sure double spending of exit is handled via definition outside of canonicity.

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
