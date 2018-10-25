<!-- markdownlint-disable MD033 -->

# omisego-plasma-mvp

This smart contract audit was prepared by [Quantstamp](https://www.quantstamp.com/), the protocol for securing smart contracts.

## Executive Summary

| Category                  | Description                                                                                                                                                                                                   |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type                      | Protocol Proof of Concept                                                                                                                                                                                     |
| Auditor(s)                | Kacper Bąk, Senior Research Engineer<br/>John Bender, Senior Research Engineer<br/>Martin Derka, Senior Research Engineer<br/>Yohei Oka, Forward Deployed Engineer<br/>Jan Gorzny, Blockchain Researcher<br/> |
| Timeline                  | 2018-09-24 through 2018-10-11                                                                                                                                                                                 |
| Language(s)               | Solidity, Python                                                                                                                                                                                              |
| Method(s)                 | Architecture Review, Unit Testing, Functional Testing, Computer-Aided Verification, Manual Review                                                                                                             |
| Specification(s)          | Tesuji Plasma Blockchain Design: <https://github.com/omisego/elixir-omg/blob/develop/docs/tesuji_blockchain_design.md><br/>                                                                                   |
| Source code               | Repository: [plasma-contracts](https://github.com/omisego/plasma-contracts)<br/>Commit: [dbbdaef]([https://github.com/omisego/plasma-contracts/commit/dbbdaef8c11456125526eb9fa444c235af79c818])<br/>Commit: [3cc6097]([https://github.com/omisego/plasma-contracts/commit/3cc6097b11c949371fee8a64d53f468f616883ae])      |
| Total Issues              | 13 (including 2 fixed)                                                                                                                                                                                                           |
| High Risk Issues          | 2                                                                                                                                                                                                             |
| Medium Risk Issues        | 0                                                                                                                                                                                                             |
| Low Risk Issues           | 1                                                                                                                                                                                                             |
| Informational Risk Issues | 10                                                                                                                                                                                                             |
| Undetermined Risk Issues  | 0                                                                                                                                                                                                             |

| Severity Level | Explanation                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High           | The issue puts a large number of users’ sensitive information at risk, or is reasonably likely to lead to catastrophic impact for client’s reputation or serious financial implications for client and users. |
| Medium         | The issue puts a subset of users’ sensitive information at risk, would be detrimental for the client’s reputation if exploited, or is reasonably likely to lead to moderate financial impact.                 |
| Low            | The risk is relatively small and could not be exploited on a recurring basis, or is a risk that the client has indicated is low-impact in view of the client’s business circumstances.                        |
| Informational  | The issue does not pose an immediate threat to continued operation or usage, but is relevant for security best practices, software engineering best practices, or defensive redundancy.                       |
| Undetermined   | The impact of the issue is uncertain.                                                                                                                                                                         |

### Goals

This report focused on evaluating security of smart contracts, as requested by the omisego-plasma-mvp team. Specific questions to answer:

- can users' funds get locked up in the Plasma child chain?
- can users successfully exit their funds should the need arise?
- can the operator steal users' funds?
- are funds protected against reorgs?

### Changelog

- Date: 2018-10-11 - Initial report
- Date: 2018-10-16 - Added recommendations and updated test section
- Date: 2018-10-22 - Investigated the relevant part of the [diff between commits dbbdaef and 3cc6097](https://github.com/omisego/plasma-contracts/compare/dbbdaef..3cc6097)

### Overall Assessment

The contracts provide a prototype implementation of Plasma. Quantstamp has found some important issues with the code, notably: violation of child block intervals that are meant to protect against reorgs (fixed in commit 3cc6097), and a possibility of carrying out a denial of service attack on exits. Furthermore, we also give a set of recommendations to ensure that the code conforms to the best practices.

-----

## Quantstamp Audit Breakdown

Quantstamp's objective was to evaluate the omisego-plasma-mvp repository for security-related issues, code quality, and adherence to specification and best-practices.
Possible issues we looked for include (but are not limited to):

- Transaction-ordering dependence
- Timestamp dependence
- Mishandled exceptions and call stack limits
- Unsafe external calls
- Integer overflow / underflow
- Number rounding errors
- Reentrancy and cross-function vulnerabilities
- Denial of service / logical oversights
- Access control
- Centralization of power
- Business logic contradicting the specification
- Code clones, functionality duplication
- Gas usage
- Arbitrary token minting  

### Methodology

The Quantstamp auditing process follows a routine series of steps:

1. Code review that includes the following:
    1. Review of the specifications, sources, and instructions provided to Quantstamp to make sure we understand the size, scope, and functionality of the smart contract.
    2. Manual review of code, which is the process of reading source code line-by-line in an attempt to identify potential vulnerabilities.
    3. Comparison to specification, which is the process of checking whether the code does what the specifications, sources, and instructions provided to Quantstamp describe.
2. Testing and automated analysis that includes the following:
    1. Test coverage analysis, which is the process of determining whether the test cases are actually covering the code and how much code is exercised when we run those test cases.  
    2. Symbolic execution, which is analyzing a program to determine what inputs cause each part of a program to execute.
3. Best-practices review, which is a review of the smart contracts to improve efficiency, effectiveness, clarify, maintainability, security, and control based on the established industry and academic practices, recommendations, and research.
4. Specific, itemized, and actionable recommendations to help you take steps to secure your smart contracts.

### Toolset

The below notes outline the setup and steps performed in the process of this audit.

### Setup

Testing setup:

- [Oyente](https://github.com/melonproject/oyente) v1.2.5
- [Mythril](https://github.com/ConsenSys/mythril) v0.2.7
- [truffle-flattener](https://github.com/alcuadrado/truffle-flattener) v0.18.9
- [MAIAN](https://github.com/MAIAN-tool/MAIAN) commit: ab387e1
- [Securify](https://github.com/eth-sri/securify)
      
## Assessment

### Findings

#### Deposit Block Can Be Written Past `CHILD_BLOCK_INTERVAL`

**Status:** Fixed

**Contract(s) affected:** `RootChain.sol`

**Severity:** High

**Description:** The contract `RootChain.sol` uses the constant `CHILD_BLOCK_INTERVAL` to distinguish between child chain and deposit blocks. It protects against reorgs, i.e., block and transaction order changing on the root chain. Reorgs can lead to spurious invalidity of the child chain. The check in line 161, however, can be bypassed and, consequently, the invariant that deposit blocks should never appear in child block indices and vice-versa can be violated. We note that the issue may be exploited by a malicious token contract which can be added by any user.

 **Exploit Scenario:**
1. Add malicious token contract to `RootChain.sol` via the function `addToken()`.
2. `depositFrom()` calls `transferFrom()` (line 164).
3. `transferFrom()` of a malicious token calls `deposit()` multiple times till `currentDepositBlock == CHILD_BLOCK_INTERVAL - 1`.
4. `transferFrom()` returns `true` allowing `writeDepositBlock()` to increment `currentDepositBlock` beyond `CHILD_BLOCK_INTERVAL`.
5. This allows a malicious token to enable transfers without a real deposit as the deposit block will be overwritten by the next submitted plasma block.

**Recommendation:** Add `require` check of `currentDepositBlock < CHILD_BLOCK_INTERVAL` to `writeDepositBlock()`.

#### Malicious Token `transfer()` Function May Block All the Subsequent Exits for the Given Token

**Contract(s) affected:** `RootChain.sol`

**Severity:** High

**Description:** Correct handling of exits is crucial for the overall security of Plasma chains. A malicious token contract may block all the subsequent exits for the given token by performing a DOS attack from within the function `finalizeExits()`.

 **Exploit Scenario:**
1. Add a malicious token contract to `RootChain.sol` via the function `addToken()`.
2. `finalizeExits()` calls `transfer()` (line 297).
3. `transfer()` intentionally returns `false`.
4. `finalizeExits()` gets reverted undoing `queue.delMin()' (line 289).

**Recommendation:** Let only the Plasma operator add token contracts which are known to be non-malicious.

#### Anybody May Initiate Deposit on Behalf of the Owner

**Contract(s) affected:** `RootChain.sol`

**Status:** Fixed

**Severity:** Low

**Description:** The function `depositFrom()` takes `owner` as parameter instead of relying on `msg.sender`. Consequently, once an allowance is approved, anybody may initiate a deposit on behalf of the owner at any time, even against the actual owner's will.

**Recommendation:** Remove the parameter `owner` from `depositFrom()` and rely on `msg.sender` instead.

#### Violation of _checks-effects-interactions_ Pattern

**Contract(s) affected:** `RootChain.sol`

**Severity:** Informational

**Description:** In the function `finalizeExits()`, the loop body (lines 287-307) allows the token `transfer()` call (line 297) to violate [checks-effects-interactions pattern](https://solidity.readthedocs.io/en/v0.4.25/security-considerations.html), which states that interactions with other contracts should happen at the very end of the function. Consequently `transfer()` may re-enter `finalizeExits()`.

**Recommendation:** Consider storing external transfers and start processing them after the loop. Alternatively, use a modifier that prevents re-entrancy into `finalizeExits()`.

#### Multiple Invocations of `startFeeExit()` Could Potentially Block Other Exists

**Contract(s) affected:** `RootChain.sol`

**Severity:** Informational

**Description:** If `currentFeeExit` becomes large enough and there are 2^128 invocations of `startFeeExit()`, the fee exits UTXO position may clash with other exits (regular exists and deposit exists) since there is no validation that `_utxoPos`, should be less than 2^128. Otherwise, the bitwise OR in `addExitToQueue()` will affect the `exitable_at` value. Consequently, one can block the other exits. We consider this attack mostly theoretical since the number of required `startFeeExit()` invocations is impractically large.

#### Clone-and-Own

**Contract(s) affected:** `ERC20.sol`, `ERC20Basic.sol`, `Math.sol`, `SafeMath.sol`, `StandardToken.sol`, `Ownable.sol`, `ECRecovery.sol`, `MintableToken.sol`, `PriorityQueue.sol`, `RootChain.sol`, `RLP.sol`

**Severity:** Informational

**Description:** The codebase relies on the clone-and-own approach for code reuse. The clone-and-own approach involves copying and adjusting open source code at one's own discretion. From the development perspective, it is initially beneficial as it reduces the amount of effort. However, from the security perspective, it involves some risks as the code may not follow the best practices, may contain a security vulnerability, or may include intentionally or unintentionally modified upstream libraries. For example, although unused, the function `copy()` in `RLP.sol` has an incorrect implementation in line 203, where `mload(dest)` should be replaced by `mload(src)`.

**Recommendation:** Rather than the clone-and-own approach, a good industry practice is to use the npm and Truffle framework for managing library dependencies. This eliminates the clone-and-own risks yet allows for following best practices, such as, using libraries. Furthermore, we recommend:
- using OpenZeppelin implementations of the following contracts: `ERC20.sol`, `ERC20Basic.sol`, `Math.sol`, `SafeMath.sol` (the current OpenZeppelin implementation uses `require` instead of `assert` statements), `StandardToken.sol` (`approve()`, `increaseApproval()`, `decreaseApproval()` should have a check for `spender != address(0)`), `Ownable.sol`, `ECRecovery.sol`, and `MintableToken.sol`.
- use `Ownable` for `PriorityQueue.sol` and `RootChain.sol`

#### Legacy Function Modifiers

**Contract(s) affected:** `ERC20.sol`, `ERC20Basic.sol`, `StandardToken.sol`, `BasicToken.sol`, `Validate.sol`

**Severity:** Informational

**Description:** Multiple functions are marked as constant. Furthermore `checkSigs()` in `Validate.sol` is marked as `internal`.

**Recommendation:** Mark the constant functions as `view`s. Mark `checkSigs()` as `pure`.

#### Unnamed Constants

**Contract(s) affected:** `PlasmaRLP.sol`, `RootChain.sol`

**Severity:** Informational

**Description:** Magic numbers, e.g., 1000000000 and 10000, are used across contracts.

**Recommendation:** Define named constants to improve code documentation and decrease the probability of making typo errors.

#### Operator Can Exit Any Amount They Want

**Contract(s) affected:** `RootChain.sol` 

**Severity:** Informational

**Description:** Fees in the contract are implicit. The function `startFeeExit()` allows the operator to exit any amount they want, since the amount is specified as a parameter. The fees will be withdrawn from the same pool that holds users' funds. According to the specification, watchers must keep observing the contract to detect possible fraud and exit users’ funds.

#### Unlocked Pragma

**Contract(s) affected:** `RootChain.sol`, `PlasmaRLP.sol`

**Severity:** Informational

**Description:** Every Solidity file specifies in the header a version number of the format `pragma solidity (^)0.4.*`. The caret (`^`) before the version number implies an unlocked pragma, meaning that the compiler will use the specified version and above, hence the term "unlocked."

**Recommendation:** For consistency and to prevent unexpected behavior in the future, it is recommended to remove the caret to lock the file onto a specific Solidity version.

#### Supplement the code with Truffle project

**Severity:** Informational

**Description:** Truffle is a prominent tool used for organizing Solidity code projects. It helps to manage dependencies, run tests, and process the code with other tools.

**Recommendation:** We recommend supplementing the code with Truffle project. For new tests, it would help to measure the code coverage (via `solidity-coverage` tool), as well as get more inputs for the gas cost analysis.

#### Use `require` instead of `assert` for argument validation

**Contract(s) affected:** `Validate.sol`

**Severity:** Informational

**Description:** The function `checkSigs()` uses `assert` to report post-validate `oindex`.

**Recommendation:** We recommend replacing the use of `assert` with `require` at the beginning of the function, and then explicitly return `false` in line 27.

#### Gas Usage / `for` Loop Concerns

**Contract(s) affected:** `RootChain.sol`, `PriorityQueue.sol`

**Severity:** Informational

**Description:** Gas usage is a main concern for smart contract developers and users, since high gas costs may prevent users from wanting to use the smart contract. Even worse, some gas usage issues may prevent the contract from providing services entirely.

Below, we answer few questions related to gas usage. We use the `PriorityQueue.sol` contract operations as a proxy for the entire `RootChain.sol` contract for calculating bounds on the number of operations due to gas consumption.

Q: How large can the queue be before `insert()` or `delMin()` exceed the block gas limit?<br/>
A: Assuming:
* the block gas limit is 8,000,000, and
* the upper bound cost of executing `insert()` or `delMin()` for a queue of size N is 21,000 + 26,538 + 6,638 * floor(log(2, N)),

the queue would have to be longer than 2^1199, which, in a real-world setting, seems like an unrealistically large number.

Q: What is the maximum size of the queue in 2 weeks?<br/>
A: Assuming:
* the block gas limit is 8,000,000,
* the upper bound cost of executing `insert()` for a queue of size N is 21,000 + 26,538 + 6,638 * floor(log(2, N)), and
* within 2 weeks Ethereum would produce 80,640 blocks containing only insertion operations,

the queue would contain at least 3,599,959 deposits. The number of deposits could be higher if `insert()` uses less gas than the assumed upper bound.

Q: How long does it take to exit the 2 week volume?<br/>
A: Assuming:
* the block gas limit is 8,000,000,
* the queue contains 3,599,959 elements,
* the upper bound cost of executing `delMin()` for a queue of size N is 21,000 + 26,538 + 6,638 * floor(log(2, N)), and
* Ethereum blocks contain no other operations besides `delMin()`,

it would take 79,868 blocks (each containing between 43 and 90 exits), i.e., almost 2 weeks.

**Recommendation:** As exits of users' funds are critical in Plasma, we would like to recommend extending the watcher with functionality that assesses and informs users about:
* how long it would take to exit funds, and
* for a given user's funds, how many exits need to be processed before they can exit.

### Test Results

#### Test Suite Results
```
$ make test
python -m pytest
==================================================== test session starts =====================================================
platform darwin -- Python 3.6.4, pytest-3.4.2, py-1.5.2, pluggy-0.6.0
rootdir: /Users/mderka/Repos/omg/plasma-contracts, inifile:
plugins: cov-2.5.1
collected 79 items                                                                                                             

tests/contracts/priority_queue/test_priority_queue.py ...........                                                                                   [ 13%]
tests/contracts/rlp/test_plasma_core.py .......                                                                                                     [ 22%]
tests/contracts/rlp/test_rlp.py ..                                                                                                                  [ 25%]
tests/contracts/root_chain/test_challenge_standard_exit.py .......                                                                                  [ 34%]
tests/contracts/root_chain/test_deposit.py .......                                                                                                  [ 43%]
tests/contracts/root_chain/test_exit_from_deposit.py .....                                                                                          [ 49%]
tests/contracts/root_chain/test_fee_exit.py ..                                                                                                      [ 51%]
tests/contracts/root_chain/test_long_run.py s                                                                                                       [ 53%]
tests/contracts/root_chain/test_process_exits.py .............                                                                                      [ 69%]
tests/contracts/root_chain/test_start_standard_exit.py ........                                                                                     [ 79%]
tests/contracts/root_chain/test_submit_block.py ..                                                                                                  [ 82%]
tests/contracts/root_chain/test_tokens.py ..                                                                                                        [ 84%]
tests/utils/test_fixed_merkle.py ............                                                                                                       [100%]

========================================================= 78 passed, 1 skipped in 167.41 seconds ==========================================================
rm -fr .pytest_cache
```

The repository implements tests using python instead of the standard Javascript test suite. As the used toolset does not provide means of measuring the test coverage, the Quantstamp team inspected the implemented tests manually. The implemented tests all pass and we consider the individual test cases reasonable.

We found one issue in the test case `test_priority_queue_insert_spam_does_not_elevate_gas_cost_above_200k` (file `test_priority_queue.py`, line 62). The statement `while gas_left < 0` should be replaced by `while gas_left > 0`.

#### Code Coverage

We were unable to measure code coverage due to lack of automated tools.

### Automated Analyses

#### Oyente

Repository: <https://github.com/melonproject/oyente>

Oyente is a symbolic execution tool that analyzes the bytecode of Ethereum smart contracts. It checks if a contract features any of the predefined vulnerabilities before the contract gets deployed on the blockchain.

##### Oyente Findings

Oyente reported integer overflow issues in the contract `RootChain.sol`. Upon closer inspection, we classified them as false positives.

#### Mythril

Repository: <https://github.com/ConsenSys/mythril>

Mythril is a security analysis tool for Ethereum smart contracts. It uses concolic analysis, taint analysis and control flow checking to detect a variety of security vulnerabilities.

##### Mythril Findings

Mythril reported the following issues:
- the use of `assert` in place of `require` in `SafeMath.sol` functions. It is a known and benign issue with former Open Zeppelin implementations.
- potential integer overflows in the contract `RootChain.sol`. Upon closer inspection, we classified them as false positives.
- execution of the function `transfer()` on a user-provided token contract. As described in the section Vulnerabilities, it may result in re-entrancy attacks on the contract.
- multiple calls to `transfer()` in a single transaction in the contract `RootChain.sol` in the function `finalizeExits()`.
- violation of _checks-effects-interactions_ pattern (described in the section Vulnerabilities).

#### MAIAN

Repository: <https://github.com/MAIAN-tool/MAIAN>

MAIAN is a tool for automatic detection of trace vulnerabilities in Ethereum smart contracts. It processes a contract's bytecode to build a trace of transactions to find and confirm bugs.

##### MAIAN Findings

MAIAN reported no issues.

#### Securify

Repository: <https://github.com/eth-sri/securify>

##### Securify Findings

Securify reported the following issues:
- reentrant method call in the contract `RootChain.sol` (discussed in the section Vulnerabilities)
- unrestricted write to storage in the contracts `PriorityQueue.sol` and `RootChain.sol`. Upon closer inspection, we classified them as false positives.
- division before multiplication in the function `startExit()` in the contract `RootChain.sol`. Upon closer inspection, we classified it as a false positive.
- unsafe call to untrusted contract, i.e., execution of the function `transfer()` on a user-provided token contract. As described in the section Vulnerabilities, it may result in re-entrancy attacks on the contract.
- unsafe dependence on block information in the contract `RootChain.sol`. Upon closer inspection, we classified it as a false positive.

-----
## Adherence to Specification

The code mostly adheres to the specification. The specification lists simplifying assumption and explains that certain features will be available in future iterations of Plasma.

## Code Documentation

The specification provides enough information to document the design and functionality of this Plasma implementation. The code, on the other hand, lacks functions and parameters descriptions. We recommend documenting the code to make it easier it to understand.

Minor issues:
- contract `Math.sol`, line 6 says "Math operations with safety checks that throw on error". There are no errors thrown from the function in this contract.
- contract `PlasmaRLP.sol`, line 15 says “Public Functions”. All the functions are marked as `internal`, not `public`.

-----

## Appendix

### File Signatures

#### Contracts

```
contracts/StandardToken.sol: e7e12ad1dfa1bafacf6344fc9a224607d21022ca0c27bc6581cd6c5c3b09b452
contracts/RootChain.sol: 32d01c35688fa585e567c554dd8d4af46869f5ebe09ecfb8d14aec868352bf7b
contracts/ERC20.sol: 5145438d41545f1cccc95d55254f57b3bc81d68da3f9ef4d116bfae55d332104
contracts/Ownable.sol: 65c0baa6928524d0ed5e52d48896517f80ee4daf32567ead41129abb1f10c7d7
contracts/PlasmaRLP.sol: 1a44f5b4feb6b056fd8d74db6e251ddda03dba6b1adb7d8a9ddcf6bf78e60df6
contracts/SafeMath.sol: e264a7d045e91dc9ba0f0bb5199e07ecd250343f8464cc78c9dc3a3f85b075ea
contracts/RLP.sol: b19cb751b112df6019d47e51308c8869feecf1f02fad96c4984002638546d75d
contracts/ERC20Basic.sol: 5c1392929d1a8c2caeb33a746e83294d5a55d7340c8870b2c829f4d7f6ed9434
contracts/PlasmaCoreTest.sol: 5546ea35adf9b5125dd0ff31e181ea79a65c6fcc90cb07916bf1076ba3c858f8
contracts/ECRecovery.sol: 75ed455845e003bc54a192239eeccb55d7b903e6ad3e88d78e7179b54ab46f7f
contracts/Validate.sol: 3516c8eb6feb7aa15c2a3dbcc5e0af43d0b63ce55411dccc3dd2962807392e67
contracts/BasicToken.sol: ef72ee7dadaea54025fd939d0bee23b0d29a278d29b4542360b5ecf783fecf68
contracts/PlasmaCore.sol: 059bc9060210e0d4ab536a52e66ded1252b7999c67c7dab8f4364432a0cae001
contracts/RLPTest.sol: 0eac6636e98d5f6a4f339136f6db7f41f7ac23221ae951b0e15e3eefa39cabe6
contracts/Merkle.sol: edcb7231316beef842ad158d574f803a0ac1df755e84919f0f7a6a332dbea9b2
contracts/Math.sol: 2658a2d9ca772268a47dc3ca42b03e8c8181ff4667a4f980843588d0c5a70412
contracts/ByteUtils.sol: ea966e98d3e3c4c484f3d144ca2e76e7acdc8dbae84e685bc554ce9de4a9ab01
contracts/MintableToken.sol: cc4d0a06c40f86926ddcb5cb19bf8b219794313f6754b5b6be856b73465c835c
contracts/PriorityQueue.sol: 006123b56ea6adc32ad4878900e76456af6ae469baa79ad29b8c32adb88e47c3
```

#### Tests

```
tests/conftest.py: 708eb79cb3ae6cd24317ca43edafa4b6abcd2835696e942161ebe0eb027be25b
tests/contracts/root_chain/test_challenge_standard_exit.py: b0391ba594526ee0f23e0233162a2c9dcc42ef28112ecf2053cb8c680722d059
tests/contracts/root_chain/test_deposit.py: bac756caed71d8b1013b77bd96fba5c2ca6998b485cbc58a7c5f2722d12267fc
tests/contracts/root_chain/test_start_standard_exit.py: 6be00c1906f35dd4f812d5afb8a01953becd7d363c53555b80139cd20e61d76c
tests/contracts/root_chain/test_process_exits.py: c29e79ac6ade42272e11a77c3c072d2d80d71edb023ba2c25b322d0d8d8a31c1
tests/contracts/root_chain/test_exit_from_deposit.py: b2e9789729dc90931208d2692d28607fcd0e222f96f7da3c64b3fbe8551d4066
tests/contracts/root_chain/test_fee_exit.py: 725c394b7ccc9eabf4a15de95308a21147c062f36ecf53ad8fb21fe5c5491194
tests/contracts/root_chain/test_submit_block.py: 20dcdaa37a6636b3fd40c0d71ba81d52744eb2b2ba36ee9d36e1e41e5f55b0a3
tests/contracts/root_chain/test_tokens.py: de487397040c3f61426d7c59583c8e85451ac49a48a20a163ec29c0fb67aab38
tests/contracts/root_chain/test_long_run.py: e5ae985d426d00f87f7074e172f74d02e899fe68c801ed12b416b197ec3979da
tests/contracts/priority_queue/test_priority_queue.py: 0513902ae4a464312651742ebc07472ee1a925632f4d34692343331d79c46c6f
tests/contracts/rlp/test_rlp.py: ea73d7293db958cef2664d167c623d8852fe3d5020ac8d1469905c164a5ff64c
tests/contracts/rlp/test_plasma_core.py: edf18eed0362b2a2985ae3cf269146c763a07cb3a4c5a12e1ef0cdbe6d37dfdc
tests/utils/test_fixed_merkle.py: 088a8dfde088a9272f18daca6c798879990a57cd9e01c08e27705c91153f67bb
```

### Steps Taken to Run the Full Test Suite and Tools

- Installed Truffle: `npm install -g truffle`
- Installed Ganache: `npm install -g ganache-cli`
- Installed the solidity-coverage tool (within the project's root directory): `npm install --save-dev solidity-coverage`
- Ran the coverage tool from the project's root directory: `./node_modules/.bin/solidity-coverage`
- Flattened the source code using `truffle-flattener` to accommodate the auditing tools.
- Installed the Mythril tool from Pypi: `pip3 install mythril`
- Ran the Mythril tool on each contract: `myth -x path/to/contract`
- Installed the Oyente tool from Docker: `docker pull luongnguyen/oyente`
- Migrated files into Oyente (root directory): `docker run -v $(pwd):/tmp -it luongnguyen/oyente`
- Ran the Oyente tool on each contract: `cd /oyente/oyente && python oyente.py /tmp/path/to/contract`
- Ran the MAIAN tool on each contract: `cd maian/tool/ && python3 maian.py -s path/to/contract contract.sol`

## About Quantstamp

Quantstamp is a Y Combinator-backed company that helps to secure smart contracts at scale using computer-aided reasoning tools, with a mission to help boost adoption of this exponentially growing technology.

Quantstamp’s team boasts decades of combined experience in formal verification, static analysis, and software verification. Collectively, our individuals have over 500 Google scholar citations and numerous published papers. In its mission to proliferate development and adoption of blockchain applications, Quantstamp is also developing a new protocol for smart contract verification to help smart contract developers and projects worldwide to perform cost-effective smart contract security audits.
To date, Quantstamp has helped to secure hundreds of millions of dollars of transaction value in smart contracts and has assisted dozens of blockchain projects globally with its white glove security auditing services. As an evangelist of the blockchain ecosystem, Quantstamp assists core infrastructure projects and leading community initiatives such as the Ethereum Community Fund to expedite the adoption of blockchain technology.

Finally, Quantstamp’s dedication to research and development in the form of collaborations with leading academic institutions such as National University of Singapore and MIT (Massachusetts Institute of Technology) reflects Quantstamp’s commitment to enable world-class smart contract innovation.

### Purpose of report

The scope of our review is limited to a review of Solidity code and only the source code we note as being within the scope of our review within this report. Cryptographic tokens are emergent technologies and carry with them high levels of technical risk and uncertainty. The Solidity language itself remains under development and is subject to unknown risks and flaws. The review does not extend to the compiler layer, or any other areas beyond Solidity that could present security risks.
The report is not an endorsement or indictment of any particular project or team, and the report does not guarantee the security of any particular project. This report does not consider, and should not be interpreted as considering or having any bearing on, the potential economics of a token, token sale or any other product, service or other asset.

No third party should rely on the reports in any way, including for the purpose of making any decisions to buy or sell any token, product, service or other asset. Specifically, for the avoidance of doubt, this report does not constitute investment advice, is not intended to be relied upon as investment advice, is not an endorsement of this project or team, and it is not a guarantee as to the absolute security of the project.

### Disclaimer

While Quantstamp delivers helpful but not-yet-perfect results, our contract reports should be considered as one element in a more complete security analysis. A warning in a contract report indicates a potential vulnerability, not that a vulnerability is proven to exist.

### Timeliness of content

The content contained in the report is current as of the date appearing on the report and is subject to change without notice, unless indicated otherwise by QTI; however, QTI does not guarantee or warrant the accuracy, timeliness, or completeness of any report you access using the internet or other means, and assumes no obligation to update any information following publication.

### Links to other websites

You may, through hypertext or other computer links, gain access to web sites operated by persons other than Quantstamp Technologies Inc. (QTI). Such hyperlinks are provided for your reference and convenience only, and are the exclusive responsibility of such web sites' owners. You agree that QTI are not responsible for the content or operation of such web sites, and that QTI shall have no liability to you or any other person or entity for the use of third-party web sites. Except as described below, a hyperlink from this web site to another web site does not imply or mean that QTI endorses the content on that web site or the operator or operations of that site. You are solely responsible for determining the extent to which you may use any content at any other web sites to which you link from the report. QTI assumes no responsibility for the use of third-party software on the website and shall have no liability whatsoever to any person or entity for the accuracy or completeness of any outcome generated by such software.

### Notice of Confidentiality

This report, including the content, data, and underlying methodologies, are subject to the confidentiality and feedback provisions in your agreement with Quantstamp. These material are not to be disclosed, extracted, copied, or distributed except to the extent expressly authorized by Quantstamp.
