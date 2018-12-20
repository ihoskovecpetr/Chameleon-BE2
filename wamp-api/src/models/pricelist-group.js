const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PricelistGroupSchema = new Schema({
    label: {
        cz: {type: String, default: ''},
        en: {type: String, default: ''}
    },
    order: {type: Number, default: 0},
    color: {type: String, default: '#919191'}
});

module.exports = mongoose.model('pricelist-group', PricelistGroupSchema);
