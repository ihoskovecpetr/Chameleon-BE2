#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/reverse-proxy-$version.tar chameleon/reverse-proxy:$version
