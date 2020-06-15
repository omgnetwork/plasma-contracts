# Deploying the contracts with Truffle

## Migration scripts
Truffle migration scripts run in the order of the numbered prefix of the filename. The naming convention is as follows:

- 1-98: Initial setup and main contracts like PlasmaFramework, SpendingConditionRegistry, etc.
- 99: Renounce the SpendingConditionRegistry because this has to happen before any ExitGames
- 100: First ExitGame contracts
- 200: Second ExitGame contracts
- 300: payment V2 experiment contracts
- 1000: Cleanup, dev/test contracts and output
- 2000: Future extensions, new exit games, etc.

## ENV VAR settings
- DEPLOYER_PRIVATEKEY: Private key of the deployer. Required when deploying with `--network remote`.
- MAINTAINER_PRIVATEKEY: Private key of the maintainer. Required when deploying with `--network remote`.
- AUTHORITY_PRIVATEKEY: Private key of the authority. Required when deploying with `--network remote`.
- REMOTE_URL: The url for the remote client to accept the call to Ethereum. eg. `https://rinkeby.infura.io/v3/${INFURA_API_TOKEN}`.
- GAS_PRICE: The gas price (in wei) used to deploy the contracts. If not set, default to 20 Gwei.
- TENDERLY: set to `true` when you need to push the contract to tenderly. Default not pushing to tenderly.
- DEPLOY_TEST_CONTRACTS: set to `true` when you need to deploy some testing contracts like mock, wrapper for conformance testing. By default test contracts are not deployed.
- MULTI_EXIT_GAME_EXPERIMENT: This is the feature flag for the experiment of doing a multiple exit games. This experiment focuses on extending to a payment v2 feature that is a clone of payment v1. So it would be deploying the same contract with slightly different parameters on indicating the tx type. Set to `true` when you need to deploy experimental contracts.
