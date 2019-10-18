#!/usr/bin/env bash
#stop on error
set -e

source_db=chameleon-devel

# docker image
mongo_docker_image=chameleon/mongodb:3
# credentials
mongo_host=srv-mongo01.upp.cz:27017
mongo_user=admin
mongo_pass=m0ng0_01_adm1n


# ======================================================================================================================
# UPDATE DB FIELDS
# ======================================================================================================================
mongo_eval () {
    docker run --name mongodb -it --rm ${mongo_docker_image} mongo -u ${mongo_user} -p ${mongo_pass} --authenticationDatabase admin ${mongo_host}/${source_db} --eval "$1"
}

echo -- rename K2rid to K2, invoices to invoice
mongo_eval 'db["projects"].updateMany({}, {$rename: {K2rid: "K2", invoices: "invoice"}})'

echo -- add bookingType field to projects - default UNCONFIRMED
mongo_eval 'db["projects"].updateMany({}, {$set: {bookingType: "UNCONFIRMED"}})'

echo -- add bookingId field to projects - default null
mongo_eval 'db["projects"].updateMany({}, {$set: {bookingId: null}})'

echo -- add mergedToProject field to booking-project - default null
mongo_eval 'db["booking-projects"].updateMany({}, {$set: {mergedToProject: null}})'

echo -- add events field to projects - default []
mongo_eval 'db["projects"].updateMany({}, {$set: {events: []}})'

echo -- add work field to projects - default []
mongo_eval 'db["projects"].updateMany({}, {$set: {work: []}})'

echo -- add bookingNote field to projects - default ""
mongo_eval 'db["projects"].updateMany({}, {$set: {bookingNote: ""}})'

echo -- add kickBack field to projects - default false
mongo_eval 'db["projects"].updateMany({}, {$set: {kickBack: false}})'