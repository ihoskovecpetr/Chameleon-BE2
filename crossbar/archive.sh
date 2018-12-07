#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/crossbar-latest.tar chameleon/crossbar:latest
cp ../docker-image-archives/crossbar-latest.tar ../docker-image-archives/crossbar-$version.tar