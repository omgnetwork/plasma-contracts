pragma solidity ^0.5.0;

library Protocol {
    uint8 constant MVP_VALUE = 1;
    uint8 constant MORE_VP_VALUE = 2;

    function MVP() internal pure returns (uint8) {
        return MVP_VALUE;
    }

    function MORE_VP() internal pure returns (uint8) {
        return MORE_VP_VALUE;
    }

    function isValidProtocol(uint8 protocol) internal pure returns (bool) {
        return protocol == MVP_VALUE || protocol == MORE_VP_VALUE;
    }
}
