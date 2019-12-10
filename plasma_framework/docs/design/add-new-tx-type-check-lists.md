# Check List For Adding New Transaction Types

This document provides some points that should be taken into consideration whenever designing a new transaction type. Since there are some known restrictions of the Plasma Framework design, please make sure that the newly created tx type and exit game does not break the global assumptions and limitations.

1. Aside from deposit transactions, all transactions should be unique. 
   - To be unique it means that the encoded transaction should not collide with another transaction.
   - Usually, a tx with valid inputs would be unique. An input would hold the information of an output identifier that can point to an output. A valid output identifier should be unique as a result making the transaction unique as well.
   - Deposit transaction is a known exception of this as it does not have inputs and the outputs can be holding with same `amount` and `token`. See: [previous related issue of deposit tx not being unique](https://github.com/omisego/plasma-contracts/issues/80)
2. `OutputId` should be unique for all outputs. This means that for each output, the current `outputId` schema should be unique and not collide with each other. We use `outputId` to flag the output in `PlasmaFramework` thus require it to be unique. The schema of `OutputId` is:
   - Deposit Output: `hash(txBytes, outputIndex, utxoPos)`
   - Other Output: `hash(txBytes, outputIndex)`
3. If the new transaction type is going to introduce new output identifier schema, please make sure it does not collide with any existing schema. We have 2 schema used at this moment: `UtxoPos` and `OutputId`.
4. Output index is max to `TX_OFFSET`  (10000) of the `UtxoPos` schema. As a result, no more than such amounts of outputs in one transaction.
5. `ExitId` for the new exit game contract must promise to be not collide with all existing `ExitId` schemas used in another exit game contracts. NOTICE: Each exit game contract can potentially introduce new schema if needed. Not recommended though.
6. When defining a new tx type, a new output type should be introduced along. Do not reuse an already existing output type. For example, even an extension of Payment V1 to Payment V2, the output should be using different output type. (see previous discussion: [here](https://github.com/omisego/plasma-contracts/issues/214#issuecomment-526466192))
7. Output type and input pointer type (output identifier schema) should be 1:1 binding. For instance, all inputs pointing to output type 1 should all be using `utxoPos` while all inputs pointing to output type 2 should all be using `outputId` schema. We should not have two inputs using different schema pointing to same output type output. (See discussion: [here](https://github.com/omisego/research/issues/93#issuecomment-517734509))
