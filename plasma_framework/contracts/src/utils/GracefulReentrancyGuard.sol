pragma solidity 0.5.11;

/**
 * @dev Helps prevent reentrant calls.
 *
 * To be used when we need reentrant call to fail.
 * Introduced because open-zeppelin ReentrancyGuard aggressively reverts the "top caller",
 * which we do not want to happen when processing exits, as a permanent failure blocks exit queue.
 * To be used in scenario where we want to protect from reentrant calls made somewhere in execution stack above 'call()()'
 * but we do not want to fail the function that makes the 'call()()'
 */
contract GracefulReentrancyGuard {
    bool private locked = false;

    /**
     * @dev Prevents reentrant calls by using a mutex.
     */
    modifier gracefullyNonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
}
