FROM node:10-alpine

RUN apk update && apk add shadow 
RUN useradd -ms /bin/bash omg

USER omg

COPY . /home/omg/
WORKDIR /home/omg/
RUN cd /home/omg/ && npm install

ENTRYPOINT ["npx", "truffle"]
