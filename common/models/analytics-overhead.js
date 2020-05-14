const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const AnalyticsOverheadSchema = new Schema({
    fix: {type: Number, default: 0},
    percent: {type: Number, default: 0},
    __v: { type: Number, select: false}
});

AnalyticsOverheadSchema.virtual('_user').set(function(v) {this.__user = v});
AnalyticsOverheadSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('analytics-overhead', AnalyticsOverheadSchema);
