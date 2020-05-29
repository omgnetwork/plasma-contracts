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

The OmiseGO implementation of the child chain and watcher can be found in our [elixir-omg](https://github.com/omisego/elixir-omg) GitHub repository.

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
npx truffle compile
```

Or run the tests
```
npm run test
```

## Configuration
The migration scripts can be configured in `plasma_framework/config.js`. Various properties of the contracts can be set here, such as the minimum exit period. See the file itself for more details. By default the `development` environment is used, but this can be set to `production` via the `DEPLOYMENT_ENV` environment variable.

You may also override the default exit period in `development` with an environment variable `MIN_EXIT_PERIOD`.


## Deploying
Deploying the contracts requires three accounts:
1. `DEPLOYER` The account that actually deploys the contracts
2. `AUTHORITY` The account that used by the Child chain to submit blocks. It must not have made any transaction prior to calling the scripts i.e. its nonce must be 0.
3. `MAINTAINER` The account that can register new vaults, exit games, etc.

Normally you will deploy the contracts using an Ethereum client that you run yourself, such as Geth or Parity. Those Ethereum client would have default accounts on the node itself. For local testing, you can leverage those accounts and deploy with `--network local` flag. The first three accounts inside the Ethereum client would be the `DEPLOYER`, `MAINTAINER`, and `AUTHORITY` account with the order.

You can also use a remote provider such as Infura that does not have control of the private key and accounts with `--network remote` flag. In this case you'll need to know the private keys for the `DEPLOYER`, `AUTHORITY` and `MAINTAINER` accounts. See [`truffle-config.js`](./plasma_framework/truffle-config.js) for an example.

Run truffle, passing in the network e.g.
```bash
npx truffle migrate --network local

# or to deploy via a remote provider
npx truffle migrate --network remote
```

You can also run within the docker with the provided [Dockerfile](./Dockerfile).
```bash
# run the following commands under the repo directory instead of under plasma_framework/

# build the docker image
docker build -t omisego/plasma-contract .

# deploy the contract
docker run --rm  omisego/plasma-contracts npx truffle migrate --network remote
```

For more detail of the deploying scripts and the env vars to set, see [deploying.md](./plasma_framework/docs/deploying/deploying.md)

### Building and running the python tests
We suggest running the following commands with an active python virtual environment ex. `venv`.
All the code is in the `plasma_framework/python_tests` directory, so go there first.

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

### Run Load Tests
We have code for load tests but is skipped by default. Currently it needs manual setup to run it locally.
You should go to the `test/loadTests/` folder to find the test you would like to enable.
Remove the `.skip` part on the test, and change it to `.only`.

The load test would need a ETH network with super high block gas limit and high initial ETH fund for test accounts. You can do the following with ganache:

```
ganache-cli -e 10000000000000 -l 0xfffffffffff
```

Run the following command to run the test afterward:

```
npx truffle test --network loadTest
```


### How to release a new plasma contracts version

- Update the [CHANGELOG.md](./CHANGELOG.md)
- Bumps the version in package.json (the patch part)
- Creates a commit with specified message
- Tags that commit with the new version
```bash
npm version patch -m "Fixed a bug in X"
```
