const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PricelistUnitSchema = new Schema({
    label: {
        cz: {type: String, default: ''},
        en: {type: String, default: ''}
    },
    timeRatio: {type: Number, default: 0}, //ratio to convert time unit to minutes, 0 if not time unit
    default: {type: Boolean, default: false},
    order: {type: Number, default: 0},
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('pricelist-unit', PricelistUnitSchema);
