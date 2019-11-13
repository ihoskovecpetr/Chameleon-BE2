const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BookingWorkTypeSchema = new Schema({
    label: String,
    K2ids: [String],
    tariff: {type: Number, default: 0},
    shortLabel: String,
    type: String,
    bookable: {type: Boolean, default: true},
    multi: {type: Boolean, default: false},
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('booking-work-type', BookingWorkTypeSchema);
