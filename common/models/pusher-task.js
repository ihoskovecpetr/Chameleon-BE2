const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PusherTaskSchema = new Schema({
    type: {type: String, default: ''},
    origin: {type: Schema.Types.ObjectId, ref: 'user', default: null },
    target: {type: Schema.Types.ObjectId, ref: 'user', default: null },
    timestamp: {type: Date, default: Date.now},
    deadline: {type: Date, default: null},
    conditions: [],
    conditionsMet: {type: Boolean, default: true},
    postpone: {type: Number, default: 0},
    project: {type: Schema.Types.ObjectId, default: null },
    dataOrigin: {type: Schema.Types.Mixed, default: null},
    dataTarget: {type: Schema.Types.Mixed, default: null},
    resolved: {type: Date, default: null},
    followed: [{type: Schema.Types.ObjectId}],
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('pusher-task', PusherTaskSchema);
