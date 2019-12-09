pragma solidity 0.5.11;

import "../framework/ExitGameController.sol";

/**
 * @notice Reentrancy guard that fails immediately when a reentrace occurs
 *         Works on multi-contracts level by activating and deactivating a reentrancy guard kept in plasma framework's state
 */
contract FailFastReentrancyGuard {

    /**
     * @dev Prevents reentrant calls by using a mutex.
     */
    modifier nonReentrant(ExitGameController exitGameController) {
        exitGameController.activateNonReentrant();
        _;
        exitGameController.deactivateNonReentrant();
    }
}
