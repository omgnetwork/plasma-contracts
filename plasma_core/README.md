# plasma-core

`plasma-core` is the repository for core components of OmiseGO's [Plasma implementation](https://github.com/omisego/plasma-mvp). These components include python classes that represent Plasma blocks and transactions, as well as signature and Merkle tree utilities.

## Getting Started

`plasma-core` is intended for use in other Plasma projects. You can make use of `plasma-core` in your projects by installing it via pip:

```bash
$ pip install plasma-core
```

You'll then be able to import modules from `plasma-core`:

```py
from plasma import Transaction, Block

inputs = [(103, 414, 1), (10301, 103, 2)] # (blknum, txindex, oindex)
outputs = [("0x9e475f8b49be49daf0571a53dda0fc9bfdbcf505", 100)] # (owner, amount)
tx = Transaction(inputs, outputs)

block = Block([tx])

print(block.hash)
```

## Contributing

We recommend setting up a virtual environment before beginning to work on `plasma-core`:

```bash
$ virtualenv env -p python3
```

### Installation

Install the necessary requirements with:

```bash
$ make
```

### Testing

Please add tests for any new features you add to `plasma-core`. We currently run tests via [`pytest`](https://docs.pytest.org/en/latest/). Run the test suite with:

```bash
$ make test
```

Make sure to use [`flake8`](http://flake8.pycqa.org/en/latest/) to lint your work before you submit a pull request:

```bash
$ make lint
```
