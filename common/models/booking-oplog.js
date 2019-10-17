const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BookingOplogSchema = new Schema({
    timestamp: {type: Date, default: Date.now},
    type: {type: String, default: 'noop'},
    user: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    data: {type: Schema.Types.Mixed, default: null},
    success: Boolean,
    reason: {type: Schema.Types.Mixed, default: null}
});

module.exports = mongoose.model('booking-oplog', BookingOplogSchema);
