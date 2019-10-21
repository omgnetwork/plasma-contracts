# Plasma Contracts

Root chain contracts for Plasma M(ore)VP, work in progress.

[![Build Status](https://circleci.com/gh/omisego/plasma-contracts.svg?style=svg)](https://circleci.com/gh/omisego/plasma-contracts)

## Contents
This version of the contract implements [MoreVP](https://ethresear.ch/t/more-viable-plasma/2160) (Fichter, Jones). This implementation is a PoA scheme with one operator and multiple watchers (users). Detailed description of our child chain design is in [Tesuji document](https://github.com/omisego/elixir-omg/blob/master/docs/tesuji_blockchain_design.md).
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
