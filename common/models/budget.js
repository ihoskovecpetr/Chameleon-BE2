const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const BudgetSchema = new Schema({
    created:  {type: Date, default: Date.now},
    modified:  {type: Date, default: Date.now},
    deleted:  {type: Date, default: null},

    label: {type: String, default: ''},
    version: {type: String, default: ''},

    language: {type: String, default: ''},
    currency: {type: String, default: ''},
    pricelist: {type: Schema.Types.ObjectId, ref: 'pricelist-snapshot', default: null },

    parts: [{type: Schema.Types.ObjectId, ref: 'budget-item'}],

    projectLabel: {type: String, default: ''},
    client: {type: String, default: ''},
    contact: {type: String, default: ''},
    date: {type: Date, default: Date.now},

    state: {type: String, default: 'CREATED'},
    offer: {type: Number, default: null},
    conditions: {type: String, default:''},
    colorOutput: {type: Boolean, default: false},
    singleOutput: {type: Boolean, default: false},
    multiTotal: {type: Boolean, default: false},
    __v: { type: Number, select: false}
});

BudgetSchema.virtual('_user').set(function(v) {this.__user = v});
BudgetSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('budget', BudgetSchema);
