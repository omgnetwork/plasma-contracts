const clonedeep = require('lodash.clonedeep');

const env = process.env.DEPLOYMENT_ENV || 'development';

const development = {
    frameworks: {
        minExitPeriod: process.env.MIN_EXIT_PERIOD || 60 * 10, // The minimum exit period for testing is 10 minutes.
        initialImmuneVaults: 2, //  Allow 2 vaults (ETH and ERC20) to be used without going through quarantine.
        initialImmuneExitGames: 2, // Allow 2 exit games (PaymentExitGame, FeeExitGame) to be used without going through quarantine.
        protocols: {
            mvp: 1,
            moreVp: 2,
        },
        // Defines how much gas should be considered safe when transferring ETH
        // Under version control so that it can be upgraded to reflect Ethereum network changes,
        // while keeping a record of the previous gas stipend.
        safeGasStipend: {
            v1: 2300,
        },
    },
    registerKeys: {
        txTypes: {
            payment: 1,
            paymentV2: 2,
            fee: 3,
        },
        outputTypes: {
            payment: 1,
            feeClaim: 2,
            feeBlockNum: 3,
        },
        vaultId: {
            eth: 1,
            erc20: 2,
        },
    },
};

const production = clonedeep(development);
production.frameworks.minExitPeriod = 60 * 60 * 24 * 7; // The minimum exit period in production is 1 week.

const config = {
    development,
    production,
};

module.exports = config[env];
