#!/usr/bin/env bash
version=$(<VERSION)
docker build -t chameleon/fluentd:latest -t chameleon/fluentd:$version .