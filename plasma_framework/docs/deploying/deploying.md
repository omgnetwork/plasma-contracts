# Deploying the contracts with Truffle

## Migration scripts
Truffle migration scripts run in the order of the numbered prefix of the filename. The naming convention is as follows:

1-98: Initial setup and main contracts like PlasmaFramework, SpendingConditionRegistry, etc.
99: Renounce the SpendingConditionRegistry because this has to happen before any ExitGames
100: First ExitGame contracts
200: Second ExitGame contracts
1000: Cleanup, dev/test contracts and output
2000: Future extensions, new exit games, etc.
