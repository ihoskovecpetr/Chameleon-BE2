#!/usr/bin/env bash
version=$(<VERSION)
node ../misc/src/makeCrossbarConfig.js
docker build  -t chameleon/crossbar:latest -t chameleon/crossbar:$version .
rm ./crossbar-node/config.json