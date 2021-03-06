'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const BookingEventSchema = new Schema({
    startDate: Date,
    facility: {type: Schema.Types.ObjectId, ref: 'booking-resource', default: null},
    operator: {type: Schema.Types.ObjectId, ref: 'booking-resource', default: null},
    confirmed: {type: Boolean, default: false},
    offtime: {type: Boolean, default: false},
    label: {type: String, default:null},
    confirmedAsProject: {type: Boolean, default: true},
    project: {type: Schema.Types.ObjectId, default: null},
    job: {type: Schema.Types.ObjectId, ref: 'booking-work-type', default: null},
    efficiency: {type: Number, default: 100},
    days: [{
        duration: {type: Number, default : 0},
        float: {type: Boolean, default : true},
        start: {type: Number, default: 0},
        _id: false
    }],
    isShooting : {type: Boolean, default: false},
    notes: {type: String, default: ''},
    virtualOperator: {type: String, default: null},
    avbEvent: {type: Schema.Types.ObjectId, default: null},
    archived: {type: Boolean, default: false},
    __v: { type: Number, select: false}
});

BookingEventSchema.virtual('_user').set(function(v) {this.__user = v});
BookingEventSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('booking-event', BookingEventSchema);
