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

echo $'\n------------  MODIFY PROJECTS DB  ------------'
echo $'------------  RENAME K2rid -> K2, invoices -> invoice, timing -> timingClient, budget -> ballpark ------------'
echo $'------------  SET bookingType: UNCONFIRMED, booking: false, paymentChecked: null, bookingId: null, events: [], work: []  ------------'
echo $'------------  SET bookingNote: "", kickBack: false, clip: [], bookingBudget: null, clientBudget: null, sentBudget: [], timingUpp: []  ------------'
echo $'------------  REMOVE onair  ------------'
mongo_eval 'db["projects"].updateMany({}, {$rename: {K2rid: "K2", invoices: "invoice", timing: "timingClient", budget: "ballpark"}, $set: {bookingType: "UNCONFIRMED", booking: false, paymentChecked: null, bookingId: null, events: [], work: [], bookingNote: "", kickBack: false, clip: [], bookingBudget: null, clientBudget: null, sentBudget: [], timingUpp: []}, $unset: {onair: true}})'

echo $'\n------------  CHANGE timinigClient ------------'
mongo_eval 'db["projects"].find({timingClient: {$ne: []}}).forEach(doc => db["projects"].findOneAndUpdate({_id: doc._id}, {$set: {timingClient: [{type: "GO_AHEAD", subType: 1, date: doc.timingClient[0].date, text: "", clip: []}]}}))'

echo $'\n------------  CHANGE lastContact to UTC ------------'
mongo_eval 'db["projects"].find({lastContact: {$ne: null}}).forEach(doc => {const d = new Date(doc.lastContact.getTime() + 10000000); db["projects"].findOneAndUpdate({_id: doc._id},{$set: {lastContact: new Date(`${d.getFullYear()}-${d.getMonth() < 9 ? "0" : ""}${d.getMonth() + 1}-${d.getDate() < 10 ? "0" : ""}${d.getDate()}T00:00:00.000Z`)}})})'

echo $'\n------------  CHANGE inquired to UTC ------------'
mongo_eval 'db["projects"].find({inquired: {$ne: null}}).forEach(doc => {const d = new Date(doc.inquired.getTime() + 10000000); db["projects"].findOneAndUpdate({_id: doc._id},{$set: {inquired: new Date(`${d.getFullYear()}-${d.getMonth() < 9 ? "0" : ""}${d.getMonth() + 1}-${d.getDate() < 10 ? "0" : ""}${d.getDate()}T00:00:00.000Z`)}})})'

echo $'\n------------  CHANGE timing go ahead date to UTC ------------'
mongo_eval 'db["projects"].find({timingClient: {$ne: []}}).forEach(doc => {const d = new Date(doc.timingClient[0].date.getTime() + 10000000); db["projects"].findOneAndUpdate({_id: doc._id}, {$set: {"timingClient.0.date": new Date(`${d.getFullYear()}-${d.getMonth() < 9 ? "0" : ""}${d.getMonth() + 1}-${d.getDate() < 10 ? "0" : ""}${d.getDate()}T00:00:00.000Z`)}})})'

echo $'\n------------  CHANGE ballpark data ------------'
mongo_eval 'db["projects"].find({}).forEach(doc => {const ballpark = doc.ballpark.ballpark; db["projects"].findOneAndUpdate({_id: doc._id}, {$set: {ballpark: ballpark}})})'

echo $'\n------------  MODIFY BOOKING-PROJECTS DB  ------------'
echo $'------------  SET mergedToProject: null  ------------'
mongo_eval 'db["booking-projects"].updateMany({}, {$set: {mergedToProject: null}})'

echo $'\n------------  REMOVE _id from booking-project: timing ------------'
mongo_eval 'db.getCollection("booking-projects").updateMany({"timing._id": {$exists: true}}, {$unset: {"timing.$[]._id": 1}})'

echo $'\n------------  REMOVE _id from jobs ------------'
mongo_eval 'db.getCollection("booking-projects").updateMany({"jobs._id": {$exists: true}}, {$unset: {"jobs.$[]._id": 1}})'

echo $'\n------------  REMOVE _id from invoice ------------'
mongo_eval 'db.getCollection("booking-projects").updateMany({"invoice._id": {$exists: true}}, {$unset: {"invoice.$[]._id": 1}})'

echo $'\n------------  MODIFY BOOKING-EVENTS DB  ------------'
echo $'------------  REMOVE _id from days ------------'
mongo_eval 'db.getCollection("booking-events").updateMany({"days._id": {$exists: true}}, {$unset: {"days.$[]._id": 1}})'

echo $'\n------------  SET booking.event start to 0 if duration is 0 ------------'
mongo_eval 'db.getCollection("booking-events").updateMany({"days.duration": 0, "days.start": {$ne: 0}}, {$set: {"days.$[].start": 0}})'

echo $'\n------------  MODIFY BUDGET-ITEMS DB  ------------'
echo $'------------  REMOVE _id from invoice ------------'
mongo_eval 'db.getCollection("budget-items").updateMany({"items._id": {$exists: true}}, {$unset: {"items.$[]._id": 1}})'

echo $'\n------------  MODIFY PRICELISTS DB  ------------'
echo $'------------  REMOVE _id from pricelist ------------'
mongo_eval 'db.getCollection("pricelists").updateMany({"pricelist._id": {$exists: true}}, {$unset: {"pricelist.$[]._id": 1}})'

echo $'\n------------  MODIFY PRICELIST-SNAPSHOT DB  ------------'
echo $'------------  REMOVE _id from pricelist ------------'
mongo_eval 'db.getCollection("pricelist-snapshots").updateMany({"pricelist._id": {$exists: true}}, {$unset: {"pricelist.$[]._id": 1}})'

echo $'\n------------  REMOVE _id from pricelist.items ------------'
mongo_eval 'db.getCollection("pricelist-snapshots").find({"pricelist.items._id": {$exists: true}}).forEach(doc => {const pricelist = doc.pricelist.map(pricelist => ({label: pricelist.label, id: pricelist.id, items: pricelist.items.map(item => ({label: item.label, id: item.id, price: item.price, unit: item.unit, unitId: item.unitId, jobId: item.jobId, clientPrice: item.clientPrice}))})); db["pricelist-snapshots"].findOneAndUpdate({_id: doc._id}, {$set: {pricelist: pricelist}})})'


