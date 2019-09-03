pragma solidity ^0.5.0;

import "../../../src/framework/utils/Operated.sol";

contract OperatedMock is Operated {
    bool public operatorCheckPassed;

    constructor()
        public
        Operated(msg.sender)
    {
        operatorCheckPassed = false;
    }

    function checkOnlyOperator() public onlyOperator {
        operatorCheckPassed = true;
    }
}
