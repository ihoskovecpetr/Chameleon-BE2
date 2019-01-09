if [[ "$#" -gt 0 ]]; then
  ./build.sh rest-api $@
fi
docker-compose down
docker-compose up -d
date=`date "+%Y%m%d"`
tail -f ./logs/chameleon_csv_${date}.log