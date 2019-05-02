pragma solidity ^0.4.0;

import "./ECRecovery.sol";
import "./Eip712StructHash.sol";


/**
 * @title SignatureTest
 * @dev Opens Eip712 structural hash for dependency conformance tests
 */
contract SignatureTest {
    /**
     * @dev Recovers signer address from signature and EIP-712 structural hash of transaction.
     * @return Signer address when signature is valid, random bytes otherwise.
     */
    function getSigner(bytes _tx, bytes _sign)
        public
        view
        returns (address)
    {
        return ECRecovery.recover(Eip712StructHash.hash(_tx), _sign);
    }
}
