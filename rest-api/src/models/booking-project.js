const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BookingProjectSchema = new Schema({
    label: String,
    K2rid: {type: String, default : null},
    K2client: {type: String, default: null},
    K2name: {type: String, default: null},
    K2projectId: {type: String, default: null},
    confirmed: {type: Boolean, default: false},
    internal: {type: Boolean, default: false},
    manager: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    supervisor: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    lead2D: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    lead3D: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    leadMP: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    producer: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    created: {type: Date, default: Date.now},
    deleted: {type: Date, default: null},
    offtime: {type: Boolean, default: false},
    events: [{type: Schema.Types.ObjectId, ref: 'booking-event'}],
    jobs: [{
        job: {type: Schema.Types.ObjectId, ref: 'booking-work-type'},
        plannedDuration: {type: Number, default : 0},
        doneDuration: {type: Number, default : 0}
    }],
    timing: [{
        date: Date,
        type: {type: String},
        text: {type: String, default: ''},
        category: {type: Number, default: 1}
    }],
    bookingNotes: {type: String, default: ''},
    onair:[{
        name: {type: String, default: null},
        date: {type: Date, default: null},
        state: {type: String, default: 'free'} //free, used, deleted
    }],
    invoice:[{
        name: {type: String, default: null},
        date: {type: Date, default: null},
    }],
    budget: {type: Schema.Types.ObjectId, ref: 'budget', default: null},
    kickBack: {type: Boolean, default: false},
    checked: {type: Date, default: null}
});

module.exports = mongoose.model('booking-project', BookingProjectSchema);
