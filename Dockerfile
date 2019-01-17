FROM node:latest
WORKDIR /build

COPY yarn.lock package.json ./

RUN yarn install

COPY /. ./