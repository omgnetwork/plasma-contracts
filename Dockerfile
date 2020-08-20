FROM node:10-alpine
ARG VAULT

RUN apk update && apk add make git g++ python

COPY . /home/plasma-contracts
RUN if [ "$VAULT" = "true" ]; then \
  WORKDIR /home/plasma-contracts/MultiSigWallet && \
  rm -Rf ./node_modules && \
  rm -Rf ./build && \
  npm install && \
  npx truffle version && \
  npx truffle compile; \
fi

WORKDIR /home/plasma-contracts/plasma_framework && \
rm -Rf ./node_modules && \
rm -Rf ./build && \
npm install && \
npx truffle version && \
npx truffle compile
