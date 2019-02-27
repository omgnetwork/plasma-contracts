# Plasma Contracts

Root chain contracts for Plasma MVP, work in progress.

## Contents
This version of the contract implements [Plasma MVP](https://ethresear.ch/t/minimal-viable-plasma/426) (Buterin, Poon, Knott). This implementation is a PoA scheme with one operator and multiple watchers (users). Detailed description of our child chain design is in [Tesuji document](https://github.com/omisego/elixir-omg/blob/master/docs/tesuji_blockchain_design.md).

Implementation differs from MVP in few regards:

* Added protection against chain re-orgs (https://github.com/omisego/plasma-mvp/pull/51).  
* Added collected fee exiting for PoA operator.  
* Added ERC20 handling.  
* Merkle tree used is of variable depth.  
* Transaction fee is implicit, not explicit.


### Plasma MVP, confirmations, and MoreVP
While this implementation contains confirmations, this is a temporary state as we are going to replace confirmations with the exit game defined in [MoreVP](https://ethresear.ch/t/more-viable-plasma/2160) (Fichter, Jones) in the future. Reasons include:

* Bad UX, need to propagate confirm sigs somehow.  
* Receiver can lie about receiving money; to prove sending, sender needs to publish confirmation to Ethereum.  
* Additional signature check per tx is needed.  
* No good way of doing partially signed transactions / atomic swaps.

### Re-org protection
See [here](https://github.com/omisego/elixir-omg/blob/develop/docs/tesuji_blockchain_design.md#reorgs).

### Protection of deposits against malicious operator, pending
Normally funds are protected by M(ore)VP mechanisms. There is an attack vector where operator spots large deposit in Ethereum mempool and produces a block to steal. If malicious block is mined before the deposit, deposit can be stolen. We are intending to use elevated exit priority for deposits so they always wait at most [Minimal Finalization Period](https://github.com/omisego/elixir-omg/blob/develop/docs/tesuji_blockchain_design.md#finalization-of-exits), while exit from fraudulent block will have to wait for Minimal Finalization Period + Required Exit Period.


# Building and running tests

Installing dependencies needed for compilation:
```
make init
```

Installing dependencies needed to run tests:
```
make dev
```

Building and running tests:
```
make test
```

Running slow (overnight) tests:
```
make runslow | tee raport.txt
```
