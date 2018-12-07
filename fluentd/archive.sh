#!/usr/bin/env bash
version=$(<VERSION)
docker save --output ../docker-image-archives/fluentd-latest.tar chameleon/fluentd:latest
cp ../docker-image-archives/fluentd-latest.tar ../docker-image-archives/fluentd-$version.tar