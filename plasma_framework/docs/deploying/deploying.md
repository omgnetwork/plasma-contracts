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
- TENDERLY: set to `true` when you need to push the contract to tenderly. Default not pushing to tenderly.
- DEPLOY_TEST_CONTRACTS: set to `true` when you need to deploy some testing contracts like mock, wrapper for conformance testing. By default test contracts are not deployed.
- EXPERIMENT: set to `true` when you need to deploy experimental contracts. For instance, deploy a new payment exit game contract to test the flow to extend the system.
