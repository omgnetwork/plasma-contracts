FROM node:10-alpine

RUN apk update && apk add make git g++ python

COPY . /home/truffle

WORKDIR /home/truffle

RUN rm -Rf ./node_modules

RUN npm install typescript && npm install
