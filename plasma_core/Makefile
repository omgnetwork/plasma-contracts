init:
	python setup.py install

.PHONY: help
help:
	@echo "clean - remove build artifacts"
	@echo "lint  - check style with flake8"
	@echo "test  - runs tests with pytest"

.PHONY: clean
clean: clean-build clean-pyc

clean-build:
	rm -fr build/
	rm -fr dist/
	rm -fr *.egg-info

clean-pyc:
	find . -name '*.pyc' -exec rm -f {} +
	find . -name '*.pyo' -exec rm -f {} +
	find . -name '*~' -exec rm -f {} +
	find . -name '*pycache__' -exec rm -rf {} +

.PHONY: lint
lint:
	flake8 plasma tests

.PHONY: test
test:
	python -m pytest
