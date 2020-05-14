const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const PricelistSchema = new Schema({
    label: {type: String, default: ''},
    currency: {type: String, default: ''},
    language: {type: String, default: ''},
    client: {type: Schema.Types.ObjectId, ref: 'budget-client'},
    pricelist : [{
        itemId: {type: Schema.Types.ObjectId, ref: 'pricelist-item'},
        price: {type: Number, default: -1},
        _id: false
    }],
    __v: { type: Number, select: false}
});

PricelistSchema.virtual('_user').set(function(v) {this.__user = v});
PricelistSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pricelist', PricelistSchema);
