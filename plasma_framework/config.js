const clonedeep = require('lodash.clonedeep');

const env = process.env.DEPLOYMENT_ENV || 'development';

const development = {
    frameworks: {
        minExitPeriod: process.env.MIN_EXIT_PERIOD || 60 * 10, // The minimum exit period for testing is 10 minutes.
        initialImmuneVaults: 2, //  Allow 2 vaults (ETH and ERC20) to be used without going through quarantine.
        initialImmuneExitGames: 1, // Allow 1 exit game (PaymentExitGame) to be used without going through quarantine.
        protocols: {
            mvp: 1,
            moreVp: 2,
        },
        // defines how much gas should be consider safe when transferring ETH
        // With version control to record old gas stipend while be able to adjust to ETH network change for upgrade.
        safeGasStipend: {
            v1: 2300,
        },
    },
    registerKeys: {
        txTypes: {
            payment: 1,
            paymentV2: 2,
        },
        outputTypes: {
            payment: 1,
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
