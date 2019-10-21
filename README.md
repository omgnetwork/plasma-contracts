# OmiseGO Plasma Framework Contracts

Root chain contracts for The OmiseGO Plasma Framework, a layer 2 scaling solution for Ethereum.

[![Build Status](https://circleci.com/gh/omisego/plasma-contracts.svg?style=svg)](https://circleci.com/gh/omisego/plasma-contracts)
[![Coverage Status](https://coveralls.io/repos/github/omisego/plasma-contracts/badge.svg?branch=master)](https://coveralls.io/github/omisego/plasma-contracts?branch=master)

## Contents

These contracts comprise the root chain component of an extensible plasma framework that can support many [Minimal Viable Plasma (MVP)](https://ethresear.ch/t/minimal-viable-plasma/426) (Buterin) style plasma constructions. The framework features the ability to extend:

  - _transaction types_, influenced by Plasma Group's [Generalized Plasma Architecture](https://medium.com/plasma-group/plapps-and-predicates-understanding-the-generalized-plasma-architecture-fc171b25741)
  - _exit games_, which can support any MVP-compatible exit game
  - _token vaults_, such as ETH and ERC-20

The framework includes a basic payment _transaction type_ for UTXO transfers, with 4 inputs and 4 outputs. These transactions are secured under [More Viable Plasma (MoreVP)](https://ethresear.ch/t/more-viable-plasma/2160) (Fichter, Jones) exits.

The framework includes two _token vaults_, supporting ETH, ERC-20, and [non-compliant ERC-20](plasma_framework/contracts/mocks/vaults/NonCompliantERC20.sol) tokens.

## Child chain and Watchers

The child chain component of our plasma construction runs under Proof of Authority, with a single operator. The construction is secured by a distributed network of watchers. Detailed description of our child chain design is in [Tesuji document](https://github.com/omisego/elixir-omg/blob/master/docs/tesuji_blockchain_design.md).

The OmiseGO implementation of the child chain and watcher can be found in our [elxir-omg](https://github.com/omisego/elixir-omg) GitHub repository.

## Learn more

You can learn more about [OmiseGO](https://omisego.co) and get started developing with our plasma framework at [developer.omisego.co](https://developer.omisego.co).


## Getting started

The easiest way to compile and deploy the contracts is with [Truffle](https://www.trufflesuite.com/truffle). 
Requires node.js >= 8.

All the code is in the `plasma_framework` directory, so go there first.
```
cd plasma_framework
```

Next install the dependencies.
```
npm install
```

You can then compile the contracts.
```
./node_modules/.bin/truffle compile
```

Or run the tests
```
./node_modules/.bin/truffle test
```

## Configuration
The migration scripts can be configured via the `migrations/config.js` file. Various properties of the contracts can be set here, such as the minimum exit period. See the file itself for more details. By default the `development` environment is used, but this can be set to `production` via the `DEPLOYMENT_ENV` environment variable.


## Deploying
Deploying the contracts requires three accounts:
1. `DEPLOYER` The account that actually deploys the contracts
2. `AUTHORITY` The account that used by the Child chain to submit blocks. It must not have made any transaction prior to calling the scripts i.e. its nonce must be 0.
3. `MAINTAINER` The account that can register new vaults, exit games, etc.


Normally you will deploy the contracts using an Ethereum client that you run yourself, such as Geth or Parity. However, you can also use a provider such as Infura. In this case you'll need to know the private keys for the `DEPLOYER`, `AUTHORITY` and `MAINTAINER` accounts. See `truffle-config.js` for an example.

Run truffle, passing in the network e.g.
```bash
./node_modules/.bin/truffle truffle migrate --network local

# or to deploy via infura
./node_modules/.bin/truffle truffle migrate --network infura
```


### Building and running the python tests

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
