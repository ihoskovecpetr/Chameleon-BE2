#!/usr/bin/env bash
version=$(<VERSION)
docker build -t chameleon/web-server:latest -t chameleon/web-server:$version .