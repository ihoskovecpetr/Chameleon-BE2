const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BookingGroupSchema = new Schema({
    label: String,
    order: Number,
    type: String,
    members: [{type: Schema.Types.ObjectId, ref: 'booking-resource'}]
});

module.exports = mongoose.model('booking-group', BookingGroupSchema);
