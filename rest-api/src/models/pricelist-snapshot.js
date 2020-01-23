const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PricelistSnapshotSchema = new Schema({
    timestamp: {type: Date, default: Date.now},
    pricelistId: {type: Schema.Types.ObjectId, ref: 'pricelist', default: null},
    label: {type: String, default: ''},
    currency: {type: String, default: ''},
    language: {type: String, default: ''},
    client: {type: String, default: ''},
    pricelist : [{
        label: {
                cz: {type: String, default: ''},
                en: {type: String, default: ''}
            },
        id: {type: Schema.Types.ObjectId, ref: 'pricelist-group', default: null},
        items: [{
            label: {
                    cz: {type: String, default: ''},
                    en: {type: String, default: ''}
                },
            id: {type: Schema.Types.ObjectId, ref: 'pricelist-item', default: null},
            price: {
                czk: {type: Number, default: 0},
                eur: {type: Number, default: 0},
                usd: {type: Number, default: 0}
            },
            generalPrice: {
                czk: {type: Number, default: -1}, // -1 not defined - old setup
                eur: {type: Number, default: -1},
                usd: {type: Number, default: -1}
            },
            unit: {
                cz: {type: String, default: ''},
                en: {type: String, default: ''}
            },
            unitId: {type: Schema.Types.ObjectId, ref: 'pricelist-unit', default: null},
            jobId: {type: Schema.Types.ObjectId, ref: 'booking-work-type', default: null},
            clientPrice: { //indicate client have defined this in pricelist even if the price is the same
                czk: {type: Boolean, default: false},
                eur: {type: Boolean, default: false},
                usd: {type: Boolean, default: false}
            }
        }]
    }],
    v2: {type: Boolean, default: true}
});

module.exports = mongoose.model('pricelist-snapshot', PricelistSnapshotSchema);
