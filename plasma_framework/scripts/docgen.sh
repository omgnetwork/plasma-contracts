#!/bin/bash
[[ -z $(git status --porcelain) ]] && rm -rf contracts/mocks && solidoc ./ ./docs/contracts && git checkout -- contracts/mocks || echo 'Please make sure all files are committed and the git status is clean'
