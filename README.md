# OmiseGO Plasma Framework Contracts

Root chain contracts for The OmiseGO Plasma Framework, a layer 2 scaling solution for Ethereum.

[![Build Status](https://circleci.com/gh/omisego/plasma-contracts.svg?style=svg)](https://circleci.com/gh/omisego/plasma-contracts)

## Contents

These contracts comprise the root chain component of an extensible plasma framework that can support many [Minimal Viable Plasma (MVP)](https://ethresear.ch/t/minimal-viable-plasma/426) (Buterin) style plasma constructions. The framework features the ability to extend:

  - _transaction types_, influenced by Plasma Group's [Generalized Plasma Architecture](https://medium.com/plasma-group/plapps-and-predicates-understanding-the-generalized-plasma-architecture-fc171b25741)
  - _exit games_, which can support any MVP-compatible exit game
  - _token vaults_, such as ETH and ERC-20

The framework includes a basic payment _transaction type_ for UTXO transfers, with 4 inputs and 4 outputs. These transactions are secured under [More Viable Plasma (MoreVP)](https://ethresear.ch/t/more-viable-plasma/2160) (Fichter, Jones) exits.

The framework includes two _token vaults_, supporting ETH, ERC-20, and [non-compliant ERC-20](plasma_framework/contracts/mocks/vaults/NonCompliantERC20.sol) tokens.

## Child chain and Watchers

The child chain component of our plasma construction runs under Proof of Authority, with a single operator. The watcher component support many watchers. Detailed description of our child chain design is in [Tesuji document](https://github.com/omisego/elixir-omg/blob/master/docs/tesuji_blockchain_design.md).

The OmiseGO implementation of the child chain and watcher can be found in our [elxir-omg](https://github.com/omisego/elixir-omg) GitHub repository.

## Learn more

You can learn more about [OmiseGO](https://omisego.co) and get started developing with our plasma framework at [developer.omisego.co](https://developer.omisego.co).


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


# Deploying with truffle
### Installation
Requires node.js >= 8

Install dependencies:
```
npm install
```


### Deploying
Deploying the contracts requires two accounts:
1. `DEPLOYER` The account that actually deploys the contracts
2. `AUTHORITY` The Authority account calls `RootChain.init()` and is the account used by the Child chain (or operator). By default a new `AUTHORITY` account is created when deploying, and will be funded with some ETH from the `DEPLOYER` account. If you prefer you can use an existing `AUTHORITY` account, but it must not have made any transaction prior to calling `RootChain.init()` i.e. its nonce must be 0.


Normally you will deploy the contracts using an Ethereum client that you run yourself, such as Geth or Parity. However, you can also use a provider such as Infura. In this case you'll need to know the private keys for the `DEPLOYER` and `AUTHORITY` accounts. See `truffle-config.js` for an example.

#### Configuration

##### Geth/Parity/Ganache-cli
Certain configuration values need to be set, depending how you're deploying. These values can be set in the environment or in a file called `.env`

 - `MIN_EXIT_PERIOD` Minimum exit period in seconds. **Required**.
 - `SOLC_VERSION` Solidity compiler version. Defaults to `0.4.25`
 - `ETH_CLIENT_HOST` Host of Ethereum client. Defaults to `127.0.0.1`
 - `ETH_CLIENT_PORT` Port of Ethereum client. Defaults to `8545`
 - `DEPLOYER_ADDRESS` Address of the `DEPLOYER` account. Defaults to `accounts[0]`
 - `DEPLOYER_PASSPHRASE` Passphrase of the `DEPLOYER` account.
 - `AUTHORITY_PASSPHRASE` Passphrase of the `AUTHORITY` account.
 - `AUTHORITY_ADDRESS_INITIAL_AMOUNT` The amount the fund the `AUTHORITY` account with (in wei). Defaults to 1 ETH.
 - `USE_EXISTING_AUTHORITY_ADDRESS` Set to `true` if you want to use an existing `AUTHORITY` account instead of creating a new one. You must also set `AUTHORITY_ADDRESS`

##### Infura
To deploy to infura, you'll need these environment variables in addition to the ones listed above.

** Important: Make sure the deployer address is funded with at least 2 ETH
** Important 2: Also make sure the nonce count of the authority is 0 (i.e. no previous transactions have been made)

- `DEPLOYER_PRIVATEKEY` Private key of the deployer address
- `AUTHORITY_PRIVATEKEY` Private key of the authority address
- `INFURA_URL` Infura Endpoint URL e.g. `https://rinkeby.infura.io/v3`
- `INFURA_API_KEY` Infura Project ID

##### Deploying

Run truffle, passing in the network e.g.
```bash
npx truffle migrate --network local

# or to deploy via infura
npx truffle migrate --network infura
```

Truffle will compile and deploy the contracts. If all goes well it will output the results:
```
{
    "contract_addr":"0xb6d73FCDD7F3E053990518eAe1306D7893EEFE12",
    "txhash_contract":"0x1595b181ece865ccc9e3a025931be0566dd6e7bec739d79faafb1d5215b01c71",
    "authority_addr":"0xF0B750F59Fff5C2be61870Dc0DA58e5e8d8F4232"
}
```
