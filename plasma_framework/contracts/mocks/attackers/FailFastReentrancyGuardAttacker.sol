pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/FailFastReentrancyGuard.sol";

contract FailFastReentrancyGuardAttacker is FailFastReentrancyGuard {

    event RemoteCallFailed();

    function guardedLocal() public nonReentrant {
        guardedLocal();
    }

    function guardedRemote() external nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(this).call(abi.encodeWithSignature("guardedRemote()"));
        if (!success) {
            emit RemoteCallFailed();
        }
    }
}
