const mongoose = require('mongoose');
const HistoryPlugin = require('../mongoHistoryPlugin');

const Schema = mongoose.Schema;

const PusherWorkRequestSchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'user'},
    messages: [{type: Schema.Types.ObjectId, ref: 'pusher-message'}],
    timestamp: {type: Date, default: Date.now},
    closed: {type: Date, default: null},
    stage: {type: Number, default: 0},
    stageTime: {type: Date, default: Date.now},
    __v: { type: Number, select: false}
});

PusherWorkRequestSchema.virtual('_user').set(function(v) {this.__user = v});
PusherWorkRequestSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pusher-work-request', PusherWorkRequestSchema);
