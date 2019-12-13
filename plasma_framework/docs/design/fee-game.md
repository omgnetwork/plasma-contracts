# Fee ExitGame Implementation

design doc: https://github.com/omisego/feat-fee/blob/master/docs/fee_exit_design.md

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
1. `txType` is a unique number that represents the type of transaction. The first fee tx would be using `3` as its tx type.
1. The `inputs` should be an empty array. 
1. The `outputs` field is an array of `Output` struct representing payment output information. There should be exactly one output. 
2. `txData` would be used to hold a `nonce` which is `hash(blockNum, token)`. `blockNum` is the block number that the fee tx is collected. `token` should be the token that this fee tx is claiming.
3. `metaData` field is a `bytes32` field that can be used to add extra data to the transaction. It should contain `0x0` if the transaction does not have extra data.

Output has four elements that fulfil the current `FungibleTokenOutputModel.Output`:
1. `outputType` represents the type of output. There would be one output type for fee which is `feeClaim` output type. It would be using number `2` as the output type.
1. `outputGuard` is the field that represents the authentication data of the output. Its value must always be the same as the `owner` address of the output. For instance, if the output belongs to Alice, then the value of `outputGuard` equals Alice's address.
1. `token` is the ERC20 token contract address that represents the transferred asset. For `ETH`, it uses `address(0)`.
1. `amount` defines how many units of the asset are being transferred.

## ExiGame contract

Fee is a really special case that instead of exiting via fee tx directly, operator would first generate fee tx and then spend the fee claim output into a payment transaction. After that, operator can exit via payment transaction just like any other payment transaction flows.

As a result, the Fee exit game contract is just a dummy empty contract existing for registration to the framework. It would declare its tx type and protocol as `MoreVP` while registration.
