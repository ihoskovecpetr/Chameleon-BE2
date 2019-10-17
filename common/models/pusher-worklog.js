const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PusherWorklogSchema = new Schema({
    _id: String,
    project: {type: Schema.Types.ObjectId, ref: 'booking-project'},
    job: {type: Schema.Types.ObjectId, ref: 'booking-work-type'},
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
    approved: {type: Boolean, default: false}
});

module.exports = mongoose.model('pusher-worklog', PusherWorklogSchema);
