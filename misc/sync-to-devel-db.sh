#!/usr/bin/env bash
#stop on error
set -e

if [[ -z "$1" ]]
  then
    echo "No source DB supplied!"
    exit 1
fi

today=`date +%Y-%m-%d_%H:%M:%S`
# docker image
mongo_docker_image=chameleon/mongodb:3
# credentials
mongo_host=srv-mongo01.upp.cz:27017
mongo_user=admin
mongo_pass=m0ng0_01_adm1n

# db names and destination folder for backup
backup_dir=db-backup
source_db=$1
destination_db="${source_db}-devel"

backup_dir_abs=`echo $(pwd)/$line`${backup_dir}
echo "Backup destination folder: ${backup_dir_abs}/${today}"

# backup source
echo "Backing up DB: ${source_db}..."
echo "--------------------------------------------------------"
docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ ${mongo_docker_image} bash -c "exec mongodump -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${source_db} --out /data/backup/${today}"

# restore to destination
echo "Restoring to DB: ${destination_db}..."
echo "--------------------------------------------------------"
docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ ${mongo_docker_image} bash -c "exec mongorestore --drop -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${destination_db} --dir /data/backup/${today}/${source_db}"
