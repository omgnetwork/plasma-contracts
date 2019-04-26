pragma solidity ^0.4.0;

import "./ECRecovery.sol";
import "./Eip712StructHash.sol";


/**
 * @title SignatureTest
 * @dev Opens Eip712 structural hash for end-to-end tests
 */
contract SignatureTest {
    /**
     * @dev Verifies signature was made by the signer.
     * @return True when signature is valid, false otherwise.
     */
    function verify(bytes _tx, bytes _sign, address _signer)
        public
        view
        returns (bool)
    {
        return _signer == ECRecovery.recover(Eip712StructHash.hash(_tx), _sign);
    }
}
