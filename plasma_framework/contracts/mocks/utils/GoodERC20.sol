pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

// A 'normal' ERC20 implementation, really only exists to force compilation of ERC20Mintable
// so that it's available in tests.
contract GoodERC20 is ERC20Mintable {
}
