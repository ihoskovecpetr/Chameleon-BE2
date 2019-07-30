#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/mongodb-$version.tar chameleon/mongodb:$version
