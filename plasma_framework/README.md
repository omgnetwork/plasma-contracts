# Plasma Framework

Plasma M(ore)VP contract with upgradeability for new feature, work in progress.

[![Build Status](https://circleci.com/gh/omisego/plasma-contracts.svg?style=svg)](https://circleci.com/gh/omisego/plasma-contracts)
[![Coverage Status](https://coveralls.io/repos/github/omisego/plasma-contracts/badge.svg?branch=master)](https://coveralls.io/github/omisego/plasma-contracts?branch=master)


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
