const mongoose = require('mongoose');
const HistoryPlugin = require('../mongoHistoryPlugin');
const Schema = mongoose.Schema;

const PusherWorkclockNotifySchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    subject: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    timestamp: {type: Date, default: Date.now},
    notified: {type: Date, default: null},
    canceled: {type: Date, default: null},
    __v: { type: Number, select: false}
});

PusherWorkclockNotifySchema.virtual('_user').set(function(v) {this.__user = v});
PusherWorkclockNotifySchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pusher-workclock-notify', PusherWorkclockNotifySchema, 'pusher-workclock-notify');
