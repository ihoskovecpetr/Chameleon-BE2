const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const BudgetClientSchema = new Schema({
    label: {type: String, default: ''},
    kickBack: {type: Number, default: 0.0},
    __v: { type: Number, select: false}
});

BudgetClientSchema.virtual('_user').set(function(v) {this.__user = v});
BudgetClientSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('budget-client', BudgetClientSchema);