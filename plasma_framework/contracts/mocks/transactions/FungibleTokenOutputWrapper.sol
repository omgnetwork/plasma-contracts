pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/transactions/FungibleTokenOutputModel.sol";

contract FungibleTokenOutputWrapper {
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    function decodeOutput(bytes memory encodedOutput)
        public
        pure
        returns (FungibleTokenOutputModel.Output memory)
    {
        GenericTransaction.Output memory genericOutput = GenericTransaction.decodeOutput(encodedOutput.toRlpItem());
        return FungibleTokenOutputModel.decodeOutput(genericOutput);
    }

    function getOutput(bytes memory transaction, uint16 outputIndex)
        public
        pure
        returns (FungibleTokenOutputModel.Output memory)
    {
        GenericTransaction.Transaction memory genericTx = GenericTransaction.decode(transaction);
        return FungibleTokenOutputModel.getOutput(genericTx, outputIndex);
    }
}
