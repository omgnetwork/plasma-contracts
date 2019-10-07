pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/GracefulReentrancyGuard.sol";

contract GracefulReentrancyGuardAttacker is GracefulReentrancyGuard {

    event RemoteCallFailed();

    function guardedLocal() public gracefullyNonReentrant {
        guardedLocal();
    }

    function guardedRemote() external gracefullyNonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(this).call(abi.encodeWithSignature("guardedRemote()"));
        if (!success) {
            emit RemoteCallFailed();
        }
    }
}
