#!/usr/bin/env bash

rm -rf ./docker-image-archives/
mkdir ./docker-image-archives/
# --------------------
# reverse-proxy
# --------------------
cd ./reverse-proxy
./build.sh
./archive.sh
cd ..

# --------------------
# web-server
# --------------------
cd ./web-server
./build.sh
./archive.sh
cd ..

# --------------------
# rest-api
# --------------------
cd ./rest-api
./build.sh
./archive.sh
cd ..

# --------------------
# crossbar
# --------------------
cd ./crossbar
./build.sh
./archive.sh
cd ..

# --------------------
# fluentd
# --------------------
cd ./fluentd
./build.sh
./archive.sh
cd ..

# --------------------
# chameleon
# --------------------
rm -rf ./dist/
mkdir ./dist/
cp -r ./docker-image-archives/ ./dist/docker-images/
cp ./.prod.env ./dist/.env
cp ./docker-compose.yml ./dist/docker-compose.yml
cp ./traefik.toml ./dist/traefik.toml
cp -r ./www ./dist/www
