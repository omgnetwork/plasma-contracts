pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../../src/utils/FailFastReentrancyGuard.sol";
import "../../src/framework/PlasmaFramework.sol";

contract FailFastReentrancyGuardAttacker is FailFastReentrancyGuard {
    PlasmaFramework private framework;

    event RemoteCallFailed();

    constructor(PlasmaFramework plasmaFramework) public {
        framework = plasmaFramework;
    }

    function guardedLocal() public nonReentrant(framework) {
        guardedLocal();
    }

    function guardedRemote() external nonReentrant(framework) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(this).call(abi.encodeWithSignature("guardedRemote()"));
        if (!success) {
            emit RemoteCallFailed();
        }
    }
}
