#!/usr/bin/env bash
version=$(<VERSION)
docker build --build-arg VERSION=$version -t chameleon/mongodb:$version .