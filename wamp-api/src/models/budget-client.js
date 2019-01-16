const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BudgetClientSchema = new Schema({
    label: {type: String, default: ''},
    kickBack: {type: Number, default: 0.0}
});

module.exports = mongoose.model('budget-client', BudgetClientSchema);