#!/usr/bin/env bash
#stop on error
set -e

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

# ======================================================================================================================
# BACKUP OLD DB
# ======================================================================================================================
# backup booking
echo -- booking database backup...
mongodump --quiet -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d booking --out ./db-backup/${today}

# backup booking-devel
echo -- booking-devel /projects/ database backup...
mongodump --quiet -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d booking-devel --out ./db-backup/${today}

# ======================================================================================================================
# RESTORE TO CHAMELEON
# ======================================================================================================================
# restore booking
echo -- restoring booking data to chameleon...
mongorestore --quiet --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${chameleon_db} --dir ./db-backup/${today}/booking

# restore projects
echo -- restoring projects data to chameleon...
mongorestore --quiet --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${chameleon_db} --nsExclude ${chameleon_db}.users --dir ./db-backup/${today}/booking-devel

# ======================================================================================================================
# UPDATE DB FIELDS
# ======================================================================================================================
echo -- removing external field from booking events
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-events"].updateMany({}, {$unset: {external: null}})'

echo -- removing external field from booking projects
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-projects"].updateMany({}, {$unset: {external: null}})'

echo -- renaming fields in booking projects: K2id to K2rid, client to K2client, projectId to K2projectId, notes to bookingNotes
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-projects"].updateMany({}, {$rename: {K2id: "K2rid", client: "K2client", projectId: "K2projectId", notes: "bookingNotes"}})'

echo -- removing EXTERNAL booking project
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-projects"].deleteOne({label: "EXTERNAL"})'

echo -- add checked field to booking projects where doesnt exists
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-projects"].updateMany({checked: {$exists: false}}, {$set: {checked: null}})'

echo -- removing allowedResources field from users
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["users"].updateMany({}, {$unset: {allowedResources: null}})'

echo -- add archived field to booking projects
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-projects"].updateMany({}, {$set: {archived: false}})'

echo -- add archived field to booking events
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-events"].updateMany({}, {$set: {archived: false}})'

echo -- add rnd field to booking projects
mongo --quiet --host ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${chameleon_db} --eval 'db["booking-projects"].updateMany({}, {$set: {rnd: false}})'