#!/usr/bin/env bash
#stop on error
set -e

# list of default dbs to backup
db_default_list=( chameleon availability )
# backup dir relative to cwd
backup_dir=db-backup

# DESTINATION DB + CREDENTIALS
mongo_version=3
mongo_host=srv-mongo01.upp.cz:27017
mongo_user=admin
mongo_pass=m0ng0_01_adm1n

# set list of dbs from command line or default list
if [[ "$#" -eq 0 ]]; then
  db_list=( "${db_default_list[@]}" )
else
  db_list=( "$@" )
fi

echo "DBs to backup: ${db_list[@]}"

today=`date +%Y-%m-%d_%H:%M:%S`

backup_dir_abs=`echo $(pwd)/$line`${backup_dir}
echo "Backup destination folder: ${backup_dir_abs}/${today}"

# BACKUP LOOP
for db in "${db_list[@]}"
do
    echo "Backing up DB: ${db}..."
    docker run --name mongodb -it --rm -v ${backup_dir_abs}:/data/backup/ chameleon/mongodb:${mongo_version} bash -c "exec mongodump -h ${mongo_host} -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin -d ${db} --out /data/backup/${today}"
done

echo "Done!"