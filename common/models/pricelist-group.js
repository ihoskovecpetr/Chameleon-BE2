const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const PricelistGroupSchema = new Schema({
    label: {
        cz: {type: String, default: ''},
        en: {type: String, default: ''}
    },
    order: {type: Number, default: 0},
    color: {type: String, default: '#919191'},
    __v: { type: Number, select: false}
});

PricelistGroupSchema.virtual('_user').set(function(v) {this.__user = v});
PricelistGroupSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('pricelist-group', PricelistGroupSchema);
