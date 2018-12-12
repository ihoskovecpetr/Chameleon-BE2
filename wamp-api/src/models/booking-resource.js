const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BookingResourceSchema = new Schema({
    label: String,
    order: Number,
    type: String,
    color: String,
    pair: {type: Schema.Types.ObjectId, ref: 'booking-resource', default: null},
    job: {type: Schema.Types.ObjectId, ref: 'booking-work-type', default: null},
    fullTime: Number,
    availability: {
        1: {type: String, default: 'full'},
        2: {type: String, default: 'full'},
        3: {type: String, default: 'full'},
        4: {type: String, default: 'full'},
        5: {type: String, default: 'full'}
    },
    group: {type: Schema.Types.ObjectId, ref: 'booking-group'},
    disabled: {type: Boolean, default: false},
    deleted: {type: Boolean, default: false},
    efficiency: {type: Number, default: 100},
    K2id: {type: String, default: null},
    exchangeMailbox : {type: String, default: null},
    guarantee : {type: Number, default: 0},
    tariff : {type: String, default: null},
    note: {type: String, default: ''},
    virtual: {type: Boolean, default: false},
    freelancer: {type: Boolean, default: false},
    confirmed: [{
        from: {type: Date, default: null},
        to: {type: Date, default: null},
        note: {type: String, default: ''},
        _id: false
    }],
    tlf: {type: String, default: null}
});

module.exports = mongoose.model('booking-resource', BookingResourceSchema);
