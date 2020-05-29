FROM node:10-alpine

RUN apk update && apk add make git g++ python

COPY . /home/plasma-contracts

WORKDIR /home/plasma-contracts/plasma_framework

RUN rm -Rf ./node_modules

RUN npm install

RUN npx truffle compile
