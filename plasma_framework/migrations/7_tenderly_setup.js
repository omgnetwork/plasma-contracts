const execSync = require('child_process').execSync;

module.exports = async (
    deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [deployerAddress, maintainerAddress, authorityAddress],
) => {
    const tenderly = process.env.TENDERLY || true;

    if (tenderly) {
        const installationStatus = execSync('curl https://raw.githubusercontent.com/Tenderly/tenderly-cli/master/scripts/install-linux.sh | sh', { encoding: 'utf-8' });  // the default is 'buffer'
        console.log('Installation Result:', installationStatus);
        const tenderlyToken = process.env.TENDERLY_TOKEN;
        if (!tenderlyToken) throw new Error('It is mandatory to set TENDERLY_TOKEN');

        const tenderlyProject = process.env.TENDERLY_PROJECT;
        if (!tenderlyProject) throw new Error('It is mandatory to set TENDERLY_PROJECT');
        
        const tenderlyProjectSetup = execSync(`tenderly init --create-project --project ${tenderlyProject}`, (error, stdout, stderr) => {
            if (error) {
                throw new Error(`Error for tenderly project init: ${error}`);
            }
        });
        console.log('Tenderly project setup:', tenderlyProjectSetup);

        const tenderlyLogin = execSync(`tenderly login --force --authentication-method=token --token=${tenderlyToken}`, (error, stdout, stderr) => {
            if (error) {
                throw new Error(`Error for tenderly push: ${error}`);
            }
        });

        console.log('Tenderly login:', tenderlyLogin);

        const tenderlyPush = execSync('tenderly push', (error, stdout, stderr) => {
            if (error) {
                throw new Error(`Error for tenderly push: ${error}`);
            }
        });
        console.log('Tenderly push:', tenderlyPush);
    }
};
