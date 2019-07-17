#!/usr/bin/env bash
#stop on error
set -e

if [[ -z "$1" ]]
  then
    echo "No image name specified!"
    echo "Use: reload-images <module-name1> <module-name2> ..."
    exit 1
fi

echo "Stopping chameleon..."
systemctl stop chameleon
sleep 1

for image in "$@"
do
    echo "Removing image chameleon/$image:latest..."
    docker image rm chameleon/${image}:latest
done
sleep 1

for image in "$@"
do
    echo "Loading image from $image-latest.tar..."
    docker load -i ./${image}-latest.tar
done
sleep 1

echo "Starting chameleon..."
systemctl start chameleon
echo "DONE!"