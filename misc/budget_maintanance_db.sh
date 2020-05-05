#!/usr/bin/env bash
#stop on error
set -e

if [[ -z "$1" ]]
  then
    echo "No DB supplied! (chameleon or chameleon-devel)"
    exit 1
fi

# docker image
mongo_docker_image=chameleon/mongodb:3
# credentials
mongo_host=srv-mongo01.upp.cz:27017
mongo_user=admin
mongo_pass=m0ng0_01_adm1n

source_db=$1

mongo_eval () {
    docker run --name mongodb -it --rm ${mongo_docker_image} mongo -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${mongo_host}/${source_db} --eval "$1"
}

# delete all 'Budget from dd-mm-yy hh:mm' budgets
echo "Removing all 'Budget from dd-mm-yy hh:mm' budgets from ${db}..."
echo "--------------------------------------------------------"
mongo_eval 'db.getCollection("budgets").updateMany({"label": /Budget from/}, {$set: {"deleted": Date.now()}})'