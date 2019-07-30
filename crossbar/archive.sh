#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/crossbar-$version.tar chameleon/crossbar:$version