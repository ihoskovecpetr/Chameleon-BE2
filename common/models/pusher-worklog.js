const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const PusherWorklogSchema = new Schema({
    _id: String,
    project: {type: Schema.Types.ObjectId},
    job: {type: Schema.Types.ObjectId, ref: 'booking-work-type'},
    remoteJob: {type: Boolean, default: false},
    operatorJob: {type: Schema.Types.ObjectId, ref: 'booking-work-type', default: null},
    operatorSurname: String,
    operatorName: String,
    operator: {type: Schema.Types.ObjectId, ref: 'user'},
    date: Date,
    hours: {type: Number, default: 0},
    description: String,
    confirm2D: {type: Number, default: 0},
    confirm3D: {type: Number, default: 0},
    confirmMP: {type: Number, default: 0},
    confirmSupervisor: {type: Number, default: 0},
    confirmManager: {type: Number, default: 0},
    confirmProducer: {type: Number, default: 0},
    resolve: {type: Boolean, default: false},
    approved: {type: Boolean, default: false},
    __v: { type: Number, select: false}
});

PusherWorklogSchema.virtual('_user').set(function(v) {this.__user = v});
PusherWorklogSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pusher-worklog', PusherWorklogSchema);
