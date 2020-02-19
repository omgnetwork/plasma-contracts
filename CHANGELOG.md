# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased - 2020-02-18

## [1.0.3] - 2020-02-18
- In-flight exit returns all unchallenged piggyback bonds even if user piggybacks the wrong canonicity. ([#585](https://github.com/omisego/plasma-contracts/pull/585))

## [1.0.2] - 2020-02-13

### Changed

- Start using "CHANGELOG.md"
- Event `BlockSubmitted` field `BlockNumber` renamed to `blknum` ([#581](https://github.com/omisego/plasma-contracts/pull/581))
- `ChallengeStandardExit`, `ChallengeOutputSpent`, `ChallengeInputSpent` take additional parameter - `senderData` ([#574](https://github.com/omisego/plasma-contracts/pull/574))
- `PaymentInFlightExitRouter.inFlightExits()` takes an array of in-flight exit IDs instead of a single ID ([#583](https://github.com/omisego/plasma-contracts/pull/583))
