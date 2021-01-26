FROM node:10-alpine
ARG VAULT
RUN apk update && apk add make git g++ python
COPY . /home/plasma-contracts

WORKDIR /home/plasma-contracts/MultiSigWallet
RUN if [ "$VAULT" = "true" ]; then \
  rm -Rf ./node_modules && \
  rm -Rf ./build && \
  npm install && \
  npx truffle version && \
  npx truffle compile; \
fi

WORKDIR /home/plasma-contracts/plasma_framework
RUN rm -Rf ./node_modules && \
rm -Rf ./build && \
npm install && \
npx truffle version && \
npx truffle compile
