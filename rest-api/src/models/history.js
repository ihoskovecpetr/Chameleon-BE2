'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HistorySchema = new Schema({
    collectionName: {type: String, index: true},
    ref: {type: mongoose.Schema.Types.ObjectId, index: true},
    patch: [],
    user: {type: String, default: null},
    timestamp: {type: Date, default: Date.now},
    method: {type: String, default: ''}
},{
    collection: '__histories'
});

HistorySchema.set('minimize', false);
HistorySchema.set('versionKey', false);
HistorySchema.set('strict', true);

module.exports = mongoose.model('__histories', HistorySchema);