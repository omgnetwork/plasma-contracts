pragma solidity ^0.5.0;

import "../../../src/framework/modifiers/Operated.sol";

contract OperatedMock is Operated {
    bool public operatorCheckPassed;

    constructor() public Operated() {
        operatorCheckPassed = false;
    }

    function checkOnlyOperator() public onlyOperator {
        operatorCheckPassed = true;
    }
}
