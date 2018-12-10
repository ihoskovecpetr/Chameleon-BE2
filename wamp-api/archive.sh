#!/usr/bin/env bash
version=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
docker save --output ../docker-image-archives/wamp-api-latest.tar chameleon/wamp-api:latest
cp ../docker-image-archives/wamp-api-latest.tar ../docker-image-archives/wamp-api-$version.tar