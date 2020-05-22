# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2020-05-21
No contract code change, mainly dependency changes, CI improvement and private repo synchronization.
- chore: upgrade truffle and fix python linter ([#630](https://github.com/omisego/plasma-contracts/pull/630))
- chore: stabilize python tests ([#619](https://github.com/omisego/plasma-contracts/pull/619))
- feat: deploy payment v2 with experiment feature flag ([#616](https://github.com/omisego/plasma-contracts/pull/616))
- feat: auto syncing between public and private repo ([#615](https://github.com/omisego/plasma-contracts/pull/615))
- chore: check api token before submission + save to artifact ([#613](https://github.com/omisego/plasma-contracts/pull/613))
- test: check that inputs can not be exited from restarted ife after outputs finalized on processing the first ife ([#611](https://github.com/omisego/plasma-contracts/pull/611))
- chore: npm audit fix ([#610](https://github.com/omisego/plasma-contracts/pull/610))
- chore: depbot upgrades ([#608](https://github.com/omisego/plasma-contracts/pull/608), [#609](https://github.com/omisego/plasma-contracts/pull/609))
- fix: slow test exceed circle ci timeout limit ([#600](https://github.com/omisego/plasma-contracts/pull/600))
- docs: add more on transaction validity. ([#597](https://github.com/omisego/plasma-contracts/pull/597))

## [1.0.4] - 2020-03-10
- Fix broken canonicity in IFE processing. ([#591](https://github.com/omisego/plasma-contracts/pull/591))
- Fix in-flight exit input-spend-challenge using wrong index. ([#593](https://github.com/omisego/plasma-contracts/pull/593))
- Add document about block retrieval. ([#570](https://github.com/omisego/plasma-contracts/pull/570))

## [1.0.3] - 2020-02-18
- In-flight exit returns all unchallenged piggyback bonds even if user piggybacks the wrong canonicity. ([#585](https://github.com/omisego/plasma-contracts/pull/585))

## [1.0.2] - 2020-02-13

### Changed

- Start using "CHANGELOG.md"
- Event `BlockSubmitted` field `BlockNumber` renamed to `blknum` ([#581](https://github.com/omisego/plasma-contracts/pull/581))
- `ChallengeStandardExit`, `ChallengeOutputSpent`, `ChallengeInputSpent` take additional parameter - `senderData` ([#574](https://github.com/omisego/plasma-contracts/pull/574))
- `PaymentInFlightExitRouter.inFlightExits()` takes an array of in-flight exit IDs instead of a single ID ([#583](https://github.com/omisego/plasma-contracts/pull/583))
