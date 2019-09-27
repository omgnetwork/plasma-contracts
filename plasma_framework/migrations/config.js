const clonedeep = require('lodash.clonedeep');

const env = process.env.NODE_ENV || 'development';

const development = {
    frameworks: {
        minExitPeriod: 60, // 1 min in seconds
        initialImmuneVaults: 2, // Preserved 2 for ETH and ERC20 vault
        initialImmuneExitGames: 1, // Preserved 1 for PaymentExitGame
        protocols: {
            mvp: 1,
            moreVp: 2,
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
production.frameworks.minExitPeriod = 60 * 60 * 24 * 7; // 1 week in seconds

const config = {
    development,
    production,
};

module.exports = config[env];
