# Plasma Framework

Plasma M(ore)VP contract with upgradeability for new feature, work in progress.

[![Build Status](https://circleci.com/gh/omisego/plasma-contracts.svg?style=svg)](https://circleci.com/gh/omisego/plasma-contracts)


# Deploying (Truffle)

```bash
export DEPLOYER_PRIVATEKEY="<redacted>"
export AUTHORITY_PRIVATEKEY="<redacted>"
export INFURA_URL="https://rinkeby.infura.io/v3"
export INFURA_API_KEY="<redacted>"

npx truffle migrate --network rinkeby
```


# Building and running tests

Installing dependencies needed for production:
```
npm install --production
```

Installing dependencies needed to development:
```
npm install
```

Building and running tests:
```
npx truffle test
```

#### Configuration
Certain configuration values need to be set. These values can be set in the environment or in a file called `.env`

 - `MOCHA_REPORTER` Please set to `eth-gas-reporter` if you want to turn on the gas reporter feature while running tests.
