const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BudgetConditionSchema = new Schema({
    language: {type: String, default:''},
    conditions: {type: String, default:''}
});

module.exports = mongoose.model('budget-condition', BudgetConditionSchema);
