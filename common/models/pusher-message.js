const mongoose = require('mongoose');
const HistoryPlugin = require('../mongoHistoryPlugin');

const Schema = mongoose.Schema;

const PusherMessageSchema = new Schema({
    type: {type: String, default: 'INFO'},
    confirm: {type: Boolean, default: false},
    followed: {type: Schema.Types.ObjectId, ref: 'pusher-message', default: null},
    origin: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    target: [{type: Schema.Types.ObjectId, ref: 'user'}],
    label: {type: String, default: ''},
    message: {type: String, default: ''},
    details: {type: String, default: ''},
    timestamp: {type: Date, default: Date.now},
    deadline: {type: Date, default: null},
    postpone: [{type: Number}],
    answer:  [{type: Schema.Types.Mixed}],
    confirmed: [{type: Date, default: null}],
    __v: { type: Number, select: false}
});

PusherMessageSchema.virtual('_user').set(function(v) {this.__user = v});
PusherMessageSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pusher-message', PusherMessageSchema);
