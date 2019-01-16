const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnalyticsOverheadSchema = new Schema({
    fix: {type: Number, default: 0},
    percent: {type: Number, default: 0}
});

module.exports = mongoose.model('analytics-overhead', AnalyticsOverheadSchema);
