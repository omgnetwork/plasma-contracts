pragma solidity ^0.5.0;

contract Freezable {
    bool private _isFrozen = false;

    modifier onlyNonFrozen() {
        require(_isFrozen == false, "The function has been frozen");
        _;
    }

    function isFrozen() public view returns (bool) {
        return _isFrozen;
    }

    function freeze() public {
        _isFrozen = true;
    }
}
