FROM node:10-alpine

RUN apk update && apk add make git g++ python

COPY . /home/plasma-contracts

WORKDIR /home/plasma-contracts/MultiSigWallet

RUN rm -Rf ./node_modules
RUN rm -Rf ./build

RUN npm install

RUN npx truffle version

RUN npx truffle compile

WORKDIR /home/plasma-contracts/plasma_framework

RUN rm -Rf ./node_modules
RUN rm -Rf ./build

RUN npm install

RUN npx truffle version

RUN npx truffle compile
