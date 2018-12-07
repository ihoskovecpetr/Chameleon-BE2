#!/usr/bin/env bash
version=$(<VERSION)
traefik_version=1.7-alpine
docker pull traefik:$traefik_version
docker tag traefik:$traefik_version chameleon/reverse-proxy:latest
docker tag traefik:$traefik_version chameleon/reverse-proxy:$version