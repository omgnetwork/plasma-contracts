pragma solidity 0.5.11;

/**
* It is by desing to be an empty contract. We only want to be able to register the tx type to the framework.
* For simplicity, a fee claiming tx does not have the ability to exit directly.
* It should be first spend to a Payment tx and then exit the fund from Payment tx.
*/
contract FeeExitGame {
}
