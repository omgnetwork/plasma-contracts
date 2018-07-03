init:
	python setup.py install

.PHONY: help
help:
	@echo "clean - remove build artifacts"
	@echo "lint  - check style with flake8"
	@echo "test  - runs tests with pytest"
	@echo "dev   - installs dev dependencies"

.PHONY: clean
clean: clean-build clean-pyc

clean-build:
	rm -fr build/
	rm -fr dist/
	rm -fr contract_data/
	rm -fr *.egg-info
	rm -fr .pytest_cache

clean-pyc:
	find . -name '*.pyc' -exec rm -f {} +
	find . -name '*.pyo' -exec rm -f {} +
	find . -name '*~' -exec rm -f {} +
	find . -name '*pycache__' -exec rm -rf {} +

.PHONY: lint
lint:
	flake8 testlang tests plasma_core

.PHONY: test
test:
	python -m pytest
	rm -fr .pytest_cache

.PHONY: dev
dev:
	pip install pylint pytest flake8
