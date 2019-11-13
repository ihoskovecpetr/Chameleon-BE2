'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const BookingGroupSchema = new Schema({
    label: String,
    order: Number,
    type: String,
    members: [{type: Schema.Types.ObjectId, ref: 'booking-resource'}],
    __v: { type: Number, select: false}
});

BookingGroupSchema.virtual('_user').set(function(v) {this.__user = v});
BookingGroupSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('booking-group', BookingGroupSchema);
