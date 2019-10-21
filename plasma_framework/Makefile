PYTHON_TESTS_DIR = python_tests/
RUN_PYTHON_MAKEFILE_COMMAND = $(MAKE) -C $(PYTHON_TESTS_DIR)  

.PHONY: clean
clean:
	rm -rf node_modules/
	$(RUN_PYTHON_MAKEFILE_COMMAND) clean

.PHONY: init
init: init_truffle init_python

.PHONY: init_truffle
init_truffle:
	npm install --python=python2

.PHONY: init_python
init_python:
	$(RUN_PYTHON_MAKEFILE_COMMAND) init dev

.PHONY: test
test: test_python test_truffle

.PHONY: test_truffle
test_truffle:
	npm test

.PHONY: lint
lint:
	$(RUN_PYTHON_MAKEFILE_COMMAND) lint
	./node_modules/.bin/eslint .
	npm run linter-sol

.PHONY: test_python
test_python:
	$(RUN_PYTHON_MAKEFILE_COMMAND) test

.PHONY: test_python_quick
test_python_quick:
	$(RUN_PYTHON_MAKEFILE_COMMAND) test_quick

