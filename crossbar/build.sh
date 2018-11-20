#!/usr/bin/env bash
version=$(<VERSION)
docker build -t chameleon/crossbar:latest -t chameleon/crossbar:$version .