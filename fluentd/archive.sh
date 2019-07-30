#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/fluentd-$version.tar chameleon/fluentd:$version
