#!/bin/bash
[[ -z $(git status --porcelain) ]] && rm -rf contracts/mocks && rm -rf contracts/poc && solidoc ./ ./docs/contracts && git checkout -- contracts/mocks && git checkout -- contracts/poc || echo 'Please make sure all files are committed and the git status is clean'
