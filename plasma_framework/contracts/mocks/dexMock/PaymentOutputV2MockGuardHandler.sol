pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./DexMockPreimageModel.sol";
import "../../src/exits/interfaces/IOutputGuardHandler.sol";
import "../../src/exits/models/OutputGuardModel.sol";
import "../../src/utils/AddressPayable.sol";

/**
 * After making output type public, we decided that Payment output and Payment DEX output share the same output type.
 * As a result, a Payment output can now be spent in a Payment transaction or a DEX transaction.
 * The output guard field would be using different mechanism. (Directly holding owner address vs hash of preimage)
 * We diffrentiate the two by the length of preimage.
 *
 * see issue: https://github.com/omisego/plasma-contracts/issues/290
 * discaimer: This implementation is only for test.
 */
contract PaymentOutputV2MockGuardHandler is IOutputGuardHandler {
    function isValid(OutputGuardModel.Data memory data) public view returns (bool) {
        if (isPayment(data)) {
            return true;
        } else {
            // To be spent in DEX transaction, check the preimage and guard is matching or not
            bytes32 hashData = keccak256(data.preimage);
            bytes20 rightMost20BytesOfHash = bytes20(uint160(uint256(hashData)));
            return data.guard == rightMost20BytesOfHash;
        }
    }

    function getExitTarget(OutputGuardModel.Data memory data) public view returns (address payable) {
        if (isPayment(data)) {
            return AddressPayable.convert(address(uint160(data.guard)));
        } else {
            DexMockPreimageModel.Preimage memory preimage = DexMockPreimageModel.decode(data.preimage);
            return AddressPayable.convert(preimage.trader);
        }
    }

    function getConfirmSigAddress(OutputGuardModel.Data memory data)
        public
        view
        returns (address)
    {
        if (isPayment(data)) {
            // MoreVP transaction, no need to have confirm sig.
            return address(0);
        } else {
            // venue would confirm the transaction for DEX
            DexMockPreimageModel.Preimage memory preimage = DexMockPreimageModel.decode(data.preimage);
            return AddressPayable.convert(preimage.venue);
        }
    }

    function isPayment(OutputGuardModel.Data memory data) private pure returns (bool) {
        return data.preimage.length == 0;
    }
}
