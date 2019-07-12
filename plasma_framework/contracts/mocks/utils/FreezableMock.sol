pragma solidity ^0.5.0;

import "../../src/utils/Freezable.sol";

contract FreezableMock is Freezable {

    event OnlyNonFrozenChecked();

    function checkOnlyNotFrozen() public onlyNonFrozen {
        emit OnlyNonFrozenChecked();
    }
}
