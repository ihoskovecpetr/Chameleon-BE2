#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/mongodb-latest.tar chameleon/mongodb:latest
cp ../docker-image-archives/mongodb-latest.tar ../docker-image-archives/mongodb-$version.tar
