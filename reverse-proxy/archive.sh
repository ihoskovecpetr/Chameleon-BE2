#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/reverse-proxy-latest.tar chameleon/reverse-proxy:latest
cp ../docker-image-archives/reverse-proxy-latest.tar ../docker-image-archives/reverse-proxy-$version.tar