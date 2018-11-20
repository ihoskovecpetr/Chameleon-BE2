#!/usr/bin/env bash
version=$(<VERSION)
docker build -t chameleon/rest-api:latest -t chameleon/rest-api:$version .