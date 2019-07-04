module.exports = {
    'extends': 'airbnb-base',
    'env': {
        mocha: true,
    },
    'rules': {
        // Four space indent
        'indent': ['error', 4],

        // Allow unused variables if they're called '_'
        'no-unused-vars': ['error', { 
          argsIgnorePattern: '_', 
          varsIgnorePattern: '_', 
        }],

        // Function hoisting is ok
        'no-use-before-define': ['error', { functions: false }],

        // Allow unary increment and decrement operators
        'no-plusplus': ['off'],

        // Longer max line length
        'max-len': ['error', 120, 2, {
            ignoreUrls: true,
            ignoreComments: false,
            ignoreRegExpLiterals: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
        }],
    },

    // Define some truffle globals
    'globals': {
        web3: false,
        contract: false,
        artifacts: false,
    },

    'overrides': [
      {
            // Allow chai.expect expressions in test files, e.g. `expect(foo).to.be.true`
            files: ['*.test.js'],
            rules: {
                'no-unused-expressions': 'off',
            },
        },
    ],
};
