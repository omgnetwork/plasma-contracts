pragma solidity 0.5.11;

import "../framework/PlasmaFramework.sol";

/**
 * @notice Reentrancy guard that fails immediately when a reentrace occurs
 * @dev Instead of using the one from openzepplin for the following reasons:
 *      1. Easier to understand
 *      2. Fail fast when reentracy occurs make testing easier
 */
contract FailFastReentrancyGuard {

    /**
     * @dev Prevents reentrant calls by using a mutex.
     */
    modifier nonReentrant(PlasmaFramework framework) {
        framework.lock();
        _;
        framework.unlock();
    }
}
