from setuptools import setup, find_packages
from os import path

here = path.abspath(path.dirname(__file__))

with open(path.join(here, 'README.md'), encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='plasma-contracts',
    version='0.0.1',
    description='Plasma root chain contracts',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/omisego/plasma-contracts',
    author='OmiseGO',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'License :: OSI Approved :: Apache Software License', # Apache License, Version 2.0 (Apache-2.0)
        'Programming Language :: Python :: 3'
    ],
    keywords='plasma contracts ethereum development solidity',
    packages=find_packages(exclude=['contrib', 'docs', 'tests']),
    install_requires=[
        'ethereum==2.3.0',
        'web3==4.3.0',
        'rlp==0.6.0',
        'py-solc==3.1.0',
        'py-solc-simple==0.0.5'
    ]
)
