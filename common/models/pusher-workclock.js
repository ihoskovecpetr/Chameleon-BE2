const mongoose = require('mongoose');
const HistoryPlugin = require('../mongoHistoryPlugin');
const Schema = mongoose.Schema;

const PusherWorkclockSchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    state: {type: String, default: ''},
    timestamp: {type: Date, default: Date.now},
    __v: { type: Number, select: false}
});

PusherWorkclockSchema.virtual('_user').set(function(v) {this.__user = v});
PusherWorkclockSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pusher-workclock', PusherWorkclockSchema);
