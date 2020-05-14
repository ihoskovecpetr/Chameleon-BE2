const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const PricelistItemSchema = new Schema({
    group: {type: Schema.Types.ObjectId, ref: 'pricelist-group', default: null},
    label : {
        cz: {type: String, default: ''},
        en: {type: String, default: ''}
    },
    job: {type: Schema.Types.ObjectId, ref: 'booking-work-type', default: null},
    unit: {type: Schema.Types.ObjectId, ref: 'pricelist-unit', default: null},
    price: {
        czk: {type: Number, default: 0},
        eur: {type: Number, default: 0},
        usd: {type: Number, default: 0}
    },
    order: {type: Number, default: 0},
    __v: { type: Number, select: false}
});

PricelistItemSchema.virtual('_user').set(function(v) {this.__user = v});
PricelistItemSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pricelist-item', PricelistItemSchema);
