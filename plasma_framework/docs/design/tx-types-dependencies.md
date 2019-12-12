# Tx Types dependencies

In an ideal world, whenever we want to expand the features of the Plasma Framework, we just need to add and register a new the Exit Game contract. However, in practice, this is not as trivial since there are some dependencies across tx types and output types due to the M(ore)VP protocol design, especially for the in-flight exit protocol.

In the in-flight exit game, there are two kinds of challenges (challenge piggyback input already spent + challenge non canonical) that are challenging the input of an in-flight tx. This increases the dependencies of input tx types of the current tx type further. For instance, if an input tx type 1 has multiple dependencies (tx type 2, 3, 4) that can spend it. And our current tx type 2 can only be spent by tx type 5. However, the Exit Game contract of tx type 2 would still need to know how a tx type 1 tx can be spent in tx type 3 and 4 too.

In conclusion, one tx type does not only have dependencies on how the tx type can be spent, but also how the input can be spent.

![Transaction dependencies](./images/transaction_dependencies.jpg)

## Code design to keep things flexible with the tx type dependencies

There are concepts that keep the system more flexible in situation when there is a need to add an extension. The `SpendingConditionRegistry` and `GenericTransaction` are ways to abstract things further.

### Spending Condition Registry

Original discussion: https://github.com/omisego/plasma-contracts/issues/214

This is a registry contract that we can describe the required dependencies graph of the spending condition. It is designed to use `(outputType, spendingTxType)` as key to describe how an output type can be spent in a spending transaction type. `outputType` is chosen since there can be multiple `outputType` of a `txType`. However, to keep things simple, it is assumed  that **all new tx types provide new output types**. So there is no single output type being used in two different tx types.

The following figure is an example of how a spending condition registry is representing the tx types dependency graph. The example here uses the the idea of [restricted custody DEX design](https://github.com/omisego/docs/blob/master/docs/restricted_custody_mvp1_spec.md). However, it is not limited to that, it merely used as an example:


![Spending condition registry graph](./images/spending-condition-registry-graph.jpg)

As you can see, the spending condition needs to take the input tx type into consideration as well. So a spending condition registry of `Payment Tx V2` still needs to register the path for `Payment Tx V1`. Same for V3, it requires all paths related to `O2` to be defined.

### Generic Transaction Format

Aside from the dependency of the path that a tx type can be spent, there are also data structure dependency. In order to be able to process a tx, it is necessary to decode the transaction first and thus the structure of the transaction need to be well defined.

#### Transaction Format

```
{
    txType: uint256
    inputs: [bytes32],
    outputs: [struct],
}
```

A `GenericTransaction` has as its first field a numerical `txType` identifier. It is a `uint256` representing the type of the transaction.

The second field `inputs` is a list of pointers that link to other outputs in previous txs that are spent in current tx.  It is `bytes32` that maps to the block, tx index and output index that is referenced. 

The third field `outputs` is a list of `Output` structs that are further described in the below paragraph. 

A transaction can have more fields than the three described above. Just the first three fields should follow this format.

#### Output Format

```
{
    outputType: uint256,
    outputGuard: bytes20,
    token: address,
    amount: uint256,
}
```

The first field of the output is a `uint256` that holds the info of `outputType`. Second field is the `outputGuard` field that would hold `owner` related information. Third field is `token`, which is the `address` that represents the `ERC20` token. The Fourth field is `amount`, a `uint256` that holds the value of amount of an output.

#### Current Payment Exit Game Implementation
Current implementation of Payment Exit Game assumes all transactions of inputs and outputs would follow the format. Under this assumption and restriction, one can add new tx types as input or output to current Payment Exit Game implementation without the need to re-write it.

We actually realize that current format of `GenericTransaction` has some limitation on adding feature. For example, if we want to add non fungible token support (ERC721 tokens), this data structure would be looking awkward to hold the information. Luckily, it is possible for us to change the format with new a Exit Game implementation design. However, it would mean an extra round of implementation and code audit.

Previous discussions:
- https://github.com/omisego/plasma-contracts/issues/236#issuecomment-546798910
- https://github.com/omisego/plasma-contracts/issues/282#issuecomment-535429760
