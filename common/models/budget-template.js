const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BudgetTemplateSchema = new Schema({
    created:  {type: Date, default: Date.now},
    modified:  {type: Date, default: Date.now},
    label: {type: String, default: ''},
    items: [{type: Schema.Types.ObjectId, ref: 'pricelist-item'}],
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('budget-template', BudgetTemplateSchema);
