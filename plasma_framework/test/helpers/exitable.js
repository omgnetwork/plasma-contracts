const calculateNormalExitable = (minExitPeriod, now, blockTimestamp) => (
    Math.max(blockTimestamp + minExitPeriod * 2, now + minExitPeriod)
);

const calculateExitableForDepositExit = (minExitPeriod, now) => now + minExitPeriod;

module.exports = {
    calculateNormalExitable,
    calculateExitableForDepositExit,
};
