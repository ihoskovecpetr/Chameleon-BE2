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

echo $'\n------------  rename K2rid to K2, invoices to invoice ------------'
mongo_eval 'db["projects"].updateMany({}, {$rename: {K2rid: "K2", invoices: "invoice"}})'

echo $'\n------------  add bookingType field to projects - default UNCONFIRMED ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {bookingType: "UNCONFIRMED"}})'

echo $'\n------------  change booking field in projects to false ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {booking: false}})'

echo $'\n------------  change paymentChecked field in projects to null ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {paymentChecked: null}})'

echo $'\n------------  add bookingId field to projects - default null ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {bookingId: null}})'

echo $'\n------------  add mergedToProject field to booking-project - default null ------------'
mongo_eval 'db["booking-projects"].updateMany({}, {$set: {mergedToProject: null}})'

echo $'\n------------  add events field to projects - default [] ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {events: []}})'

echo $'\n------------  add work field to projects - default [] ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {work: []}})'

echo $'\n------------  add bookingNote field to projects - default "" ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {bookingNote: ""}})'

echo $'\n------------  add kickBack field to projects - default false ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {kickBack: false}})'

#echo $'\n------------  remove dateTo field from projects.timing ------------'
#mongo_eval 'db["projects"].updateMany({timing: {$ne: []}}, {$unset: {"timing.0.dateTo": true}})'

echo $'\n------------  remove onair field from projects ------------'
mongo_eval 'db["projects"].updateMany({}, {$unset: {onair: true}})'

echo $'\n------------  add clip field to projects ------------'
mongo_eval 'db["projects"].updateMany({}, {$set: {clip: []}})'

echo $'\n------------  remove _id from booking-project: timing ------------'
mongo_eval 'db.getCollection("booking-projects").updateMany({"timing._id": {$exists: true}}, {$unset: {"timing.$[]._id": 1}})'

#echo $'\n------------  remove _id from project: timing ------------'
#mongo_eval 'db.getCollection("projects").updateMany({"timing._id": {$exists: true}}, {$unset: {"timing.$[]._id": 1}})'

echo $'\n------------  remove _id from booking-project: jobs ------------'
mongo_eval 'db.getCollection("booking-projects").updateMany({"jobs._id": {$exists: true}}, {$unset: {"jobs.$[]._id": 1}})'

echo $'\n------------  remove _id from booking-project: invoice ------------'
mongo_eval 'db.getCollection("booking-projects").updateMany({"invoice._id": {$exists: true}}, {$unset: {"invoice.$[]._id": 1}})'

echo $'\n------------  remove _id from booking-event: days ------------'
mongo_eval 'db.getCollection("booking-events").updateMany({"days._id": {$exists: true}}, {$unset: {"days.$[]._id": 1}})'

echo $'\n------------  remove _id from budget-item: invoice ------------'
mongo_eval 'db.getCollection("budget-items").updateMany({"items._id": {$exists: true}}, {$unset: {"items.$[]._id": 1}})'

echo $'\n------------  set booking.event start to 0 if duration is 0 ------------'
mongo_eval 'db.getCollection("booking-events").updateMany({"days.duration": 0, "days.start": {$ne: 0}}, {$set: {"days.$[].start": 0}})'

echo $'\n------------  remove _id from pricelists: pricelist ------------'
mongo_eval 'db.getCollection("pricelists").updateMany({"pricelist._id": {$exists: true}}, {$unset: {"pricelist.$[]._id": 1}})'

echo $'\n------------  remove _id from pricelist-snapshot: pricelist ------------'
mongo_eval 'db.getCollection("pricelist-snapshots").updateMany({"pricelist._id": {$exists: true}}, {$unset: {"pricelist.$[]._id": 1}})'

echo $'\n------------  remove _id from pricelist-snapshot: pricelist and pricelist.items ------------'
mongo_eval 'db.getCollection("pricelist-snapshots").find({"pricelist.items._id": {$exists: true}}).forEach(doc => {const pricelist = doc.pricelist.map(pricelist => ({label: pricelist.label, id: pricelist.id, items: pricelist.items.map(item => ({label: item.label, id: item.id, price: item.price, unit: item.unit, unitId: item.unitId, jobId: item.jobId, clientPrice: item.clientPrice}))})); db["pricelist-snapshots"].findOneAndUpdate({_id: doc._id}, {$set: {pricelist: pricelist}})})'

echo $'\n------------  change timing to timinigClient and add timingUpp  ------------'
mongo_eval 'db["projects"].updateMany({}, {$rename: {timing: "timingClient"}, $set: {timingUpp: []}})'

echo $'\n------------  change timinigClient ------------'
mongo_eval 'db["projects"].find({timingClient: {$ne: []}}).forEach(doc => db["projects"].findOneAndUpdate({_id: doc._id}, {$set: {timingClient: [{type: "GO_AHEAD", date: doc.timingClient[0].date, text: "", clip: []}]}}))'

echo $'\n------------  change projects lastContact to UTC ------------'
mongo_eval 'db["projects"].find({lastContact: {$ne: null}}).forEach(doc => {const d = new Date(doc.lastContact.getTime() + 10000000); db["projects"].findOneAndUpdate({_id: doc._id},{$set: {lastContact: new Date(`${d.getFullYear()}-${d.getMonth() < 9 ? "0" : ""}${d.getMonth() + 1}-${d.getDate() < 10 ? "0" : ""}${d.getDate()}T00:00:00.000Z`)}})})'

echo $'\n------------  change projects inquired to UTC ------------'
mongo_eval 'db["projects"].find({inquired: {$ne: null}}).forEach(doc => {const d = new Date(doc.inquired.getTime() + 10000000); db["projects"].findOneAndUpdate({_id: doc._id},{$set: {inquired: new Date(`${d.getFullYear()}-${d.getMonth() < 9 ? "0" : ""}${d.getMonth() + 1}-${d.getDate() < 10 ? "0" : ""}${d.getDate()}T00:00:00.000Z`)}})})'

echo $'\n------------  change timing go ahead date to UTC ------------'
mongo_eval 'db["projects"].find({timingClient: {$ne: []}}).forEach(doc => {const d = new Date(doc.timingClient[0].date.getTime() + 10000000); db["projects"].findOneAndUpdate({_id: doc._id}, {$set: {"timingClient.0.date": new Date(`${d.getFullYear()}-${d.getMonth() < 9 ? "0" : ""}${d.getMonth() + 1}-${d.getDate() < 10 ? "0" : ""}${d.getDate()}T00:00:00.000Z`)}})})'