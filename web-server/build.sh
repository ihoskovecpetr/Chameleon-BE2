#!/usr/bin/env bash
version=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
rm -r ./_common
cp  -r ../common ./_common
docker build -t chameleon/web-server:$version .