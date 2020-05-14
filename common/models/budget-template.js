const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const BudgetTemplateSchema = new Schema({
    created:  {type: Date, default: Date.now},
    modified:  {type: Date, default: Date.now},
    label: {type: String, default: ''},
    items: [{type: Schema.Types.ObjectId, ref: 'pricelist-item'}],
    __v: { type: Number, select: false}
});

BudgetTemplateSchema.virtual('_user').set(function(v) {this.__user = v});
BudgetTemplateSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('budget-template', BudgetTemplateSchema);
