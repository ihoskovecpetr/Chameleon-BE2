const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const PusherGroupSchema = new Schema({
    label: String,
    owner: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    members: [{type: Schema.Types.ObjectId, ref: 'user'}],
    __v: { type: Number, select: false}
});

PusherGroupSchema.virtual('_user').set(function(v) {this.__user = v});
PusherGroupSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pusher-group', PusherGroupSchema);
