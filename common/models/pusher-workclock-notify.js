const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PusherWorkclockNotifySchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    subject: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    timestamp: {type: Date, default: Date.now},
    notified: {type: Date, default: null},
    canceled: {type: Date, default: null},
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('pusher-workclock-notify', PusherWorkclockNotifySchema, 'pusher-workclock-notify');
