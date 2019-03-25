pragma solidity ^0.4.0;

import "./Bits.sol";
import "./PlasmaCore.sol";


/**
 * @title InFlightExit
 * @dev Operations on in-flight exits
 */
library InFlightExit {
    using Bits for uint256;

    // Applies to outputs too
    uint8 constant public MAX_INPUTS = 4;

    struct IFE {
        uint256 exitStartTimestamp;
        uint256 exitPriority;
        uint256 exitMap;
        PlasmaCore.TransactionOutput[MAX_INPUTS] inputs;
        PlasmaCore.TransactionOutput[MAX_INPUTS] outputs;
        address bondOwner;
        uint256 oldestCompetitor;
    }

    function isPiggybacked(IFE _ife, uint8 _output)
        pure
        internal
        returns (bool)
    {
        return _ife.exitMap.bitSet(_output);
    }

    function isExited(IFE _ife, uint8 _output)
        pure
        internal
        returns (bool)
    {
        return _ife.exitMap.bitSet(_output + MAX_INPUTS * 2);
    }

    function isInputSpent(IFE storage _ife)
        view
        internal
        returns (bool)
    {
        return _ife.exitStartTimestamp.bitSet(254);
    }

    function piggyback(IFE storage _ife, uint8 _output)
        internal
        returns (IFE storage)
    {
        _ife.exitMap = _ife.exitMap.setBit(_output);
        return _ife;
    }

    function markExited(IFE storage _ife, uint8 _output)
        internal
        returns (IFE storage)
    {
        _ife.exitMap = _ife.exitMap.clearBit(_output).setBit(_output + 2 * MAX_INPUTS);
        return _ife;
    }

    function markInputSpent(IFE storage _ife)
        internal
        returns (IFE storage)
    {
        _ife.exitStartTimestamp = _ife.exitStartTimestamp.setBit(254);
        return _ife;
    }

    function finalize(IFE storage _ife)
        internal
        returns (IFE storage)
    {
        _ife.exitMap = _ife.exitMap.setBit(255);
        return _ife;
    }

    function markInputExitable(IFE storage _ife)
        internal
        returns (IFE storage)
    {
        _ife.exitStartTimestamp = _ife.exitStartTimestamp.setBit(255);
        return _ife;
    }

    function cancelExit(IFE storage _ife, uint8 _output)
        internal
        returns (IFE storage)
    {
        _ife.exitMap = _ife.exitMap.clearBit(_output);
        return _ife;
    }

    function blockInputsExit(IFE storage _ife)
        internal
        returns (IFE storage)
    {
        _ife.exitStartTimestamp = _ife.exitStartTimestamp.clearBit(255);
        return _ife;
    }

    function isFinalized(IFE storage _ife)
        view
        internal
        returns (bool)
    {
        return _ife.exitMap.bitSet(255) || _ife.exitMap.bitSet(254);
    }

    function areInputsExitable(IFE storage _ife)
        view
        internal
        returns (bool)
    {
        return _ife.exitStartTimestamp.bitSet(255) || _ife.exitStartTimestamp.bitSet(254);
    }
}
