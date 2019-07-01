#!/usr/bin/env bash
#stop on error
set -e

use_docker=true

if [[ -z "$1" ]]
  then
    echo "No destination DB supplied as the first argument!"
    exit 1
fi

today=`date +%Y-%m-%d_%H:%M:%S`

# DESTINATION DB + CREDENTIALS
chameleon_db=$1

echo "Source DBs: booking + booking-devel (projects)"
echo "Destination DB: $chameleon_db"

mongo_host=srv-mongo01.upp.cz:27017
mongo_user=admin
mongo_pass=m0ng0_01_adm1n

backup_dir=db-backup
backup_dir_abs=`echo $(pwd)/$line`${backup_dir}
echo "Backup destination folder: ${backup_dir_abs}/${today}"

# ======================================================================================================================
# BACKUP OLD DB
# ======================================================================================================================
# backup booking
echo -- booking database backup...
if [[ "$use_docker" = true ]]
then
    docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ chameleon/mongodb:latest bash -c "exec mongodump --quiet -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d booking --out /data/backup/${today}"
else
    mongodump --quiet -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d booking --out ./${backup_dir}/${today}
fi

# backup booking-devel
echo -- booking-devel /projects/ database backup...
if [[ "$use_docker" = true ]]
then
    docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ chameleon/mongodb:latest bash -c "exec mongodump --quiet -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d booking-devel --out /data/backup/${today}"
else
    mongodump --quiet -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d booking-devel --out ./${backup_dir}/${today}
fi

# ======================================================================================================================
# RESTORE TO CHAMELEON
# ======================================================================================================================
# restore booking
echo -- restoring booking data to chameleon...
if [[ "$use_docker" = true ]]
then
    docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ chameleon/mongodb:latest bash -c "exec mongorestore --quiet --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${chameleon_db} --dir /data/backup/${today}/booking"
else
    mongorestore --quiet --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${chameleon_db} --dir ./${backup_dir}/${today}/booking
fi

# restore projects
echo -- restoring projects data to chameleon...
echo -- restoring booking data to chameleon...
if [[ "$use_docker" = true ]]
then
    docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ chameleon/mongodb:latest bash -c "exec mongorestore --quiet --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${chameleon_db} --nsExclude ${chameleon_db}.users --dir /data/backup/${today}/booking-devel"
else
    mongorestore --quiet --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${chameleon_db} --nsExclude ${chameleon_db}.users --dir ./${backup_dir}/${today}/booking-devel
fi

# ======================================================================================================================
# UPDATE DB FIELDS
# ======================================================================================================================
mongo_eval () {
    if [[ "$use_docker" = true ]]
    then
        docker run --name mongodb -it --rm chameleon/mongodb:latest mongo -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${mongo_host}/${chameleon_db} --eval "$1"
    else
        mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval "$1"
    fi
}

echo -- removing external field from booking events
mongo_eval 'db["booking-events"].updateMany({}, {$unset: {external: null}})'

echo -- removing external field from booking projects
mongo_eval 'db["booking-projects"].updateMany({}, {$unset: {external: null}})'

echo -- renaming fields in booking projects: K2id to K2rid, client to K2client, projectId to K2projectId, notes to bookingNotes
mongo_eval 'db["booking-projects"].updateMany({}, {$rename: {K2id: "K2rid", client: "K2client", projectId: "K2projectId", notes: "bookingNotes"}})'

echo -- removing EXTERNAL booking project
mongo_eval 'db["booking-projects"].deleteOne({label: "EXTERNAL"})'

echo -- add checked field to booking projects where doesnt exists
mongo_eval 'db["booking-projects"].updateMany({checked: {$exists: false}}, {$set: {checked: null}})'

echo -- removing allowedResources field from users
mongo_eval 'db["users"].updateMany({}, {$unset: {allowedResources: null}})'

echo -- add archived field to booking projects
mongo_eval 'db["booking-projects"].updateMany({}, {$set: {archived: false}})'

echo -- add archived field to booking events
mongo_eval 'db["booking-events"].updateMany({}, {$set: {archived: false}})'

echo -- add rnd field to booking projects
mongo_eval 'db["booking-projects"].updateMany({}, {$set: {rnd: false}})'