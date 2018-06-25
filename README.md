# Plasma MVP

This is a research implementation of [Minimal Viable Plasma](https://ethresear.ch/t/minimal-viable-plasma/426).

## Getting Started

### Dependencies

#### [Solidity](https://solidity.readthedocs.io/en/latest/installing-solidity.html)

Mac:
```sh
brew update
brew upgrade
brew tap ethereum/ethereum
brew install solidity
```

Linux:
```sh
sudo add-apt-repository ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install solc
```

Windows:

Follow [this guide](https://solidity.readthedocs.io/en/latest/installing-solidity.html#prerequisites-windows)

#### [Python 3.2+](https://www.python.org/downloads/)

Mac:
```sh
brew install python
```

Linux:
```sh
sudo apt-get install software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install python3
```

Windows:
```sh
choco install python
```

### Installation

Note: we optionally recommend using something like [`virtualenv`](https://pypi.python.org/pypi/virtualenv) in order to create an isolated Python environment:

```
$ virtualenv env -p python3
```

Fetch and install the project's dependencies with:

```
$ make
```

### Testing

Project tests can be found in the `tests/` folder. Run tests with:

```
$ make test
```

If you're contributing to this project, make sure you also install [`flake8`](https://pypi.org/project/flake8/) and lint your work:

```
$ make lint
```
