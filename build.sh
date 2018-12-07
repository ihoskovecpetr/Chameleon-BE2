#!/usr/bin/env bash
#stop on error
set -e

app_full_list=( reverse-proxy fluentd web-server rest-api crossbar )

#set list of services from command line or default full list
if [ "$#" -eq 0 ]; then
  app_list=( "${app_full_list[@]}" chameleon )
else
  app_list=( "$@" )
fi

#remove chameleon if exists - to do it at the end
num_of_apps=${#app_list[@]}
app_list=(${app_list[@]//chameleon/})
num_of_apps_minus_chameleon=${#app_list[@]}
do_dist=`expr $num_of_apps - $num_of_apps_minus_chameleon`

# Build and archive all required docker images
for app in "${app_list[@]}"
do
    echo =================================================
    echo Building and archiving  \"$app\"
    echo =================================================
    mkdir -p ./docker-image-archives
    cd ./$app
    ./build.sh
    ./archive.sh
    cd ..
done


# Make distribution folder if required
if [ "$do_dist" -gt 0 ]
then
    echo =================================================
    echo Building distribution folder for \"Chameleon\"
    echo =================================================

    rm -rf ./dist/
    mkdir -p ./dist/docker-images

    for app_image in "${app_full_list[@]}"
    do
        cp ./docker-image-archives/$app_image-latest.tar ./dist/docker-images/$app_image-latest.tar
    done

    cp ./.prod.env ./dist/.env
    cp ./docker-compose.yml ./dist/docker-compose.yml
    cp ./traefik-prod.toml ./dist/traefik.toml
    cp -r ./www ./dist/www
fi



