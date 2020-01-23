const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BudgetItemSchema = new Schema({
    label: {type: String, default: ''},
    offer: {type: Number, default: null},
    active: {type: Boolean, default: true},
    output: {type: Boolean, default: true},
    items: [{
        isGroup: {type: Boolean, default: false},
        label: {type: String, default: ''},
        price: {type: Number, default: 0},
        generalPrice: {type: Number, default: -1}, // -1 not set - old setup
        fixed: {type: Boolean, default: true},
        unit: {type: String, default: ''},
        unitId: {type: Schema.Types.ObjectId, ref: 'pricelist-unit', default: null },
        unitDuration: {type: Number, default: 0},
        numberOfUnits: {type: Number, default: 0},
        job: {type: Schema.Types.ObjectId, ref: 'booking-work-type', default: null },
        id: {type: Schema.Types.ObjectId, default: null},
        subtotal: {type: Boolean, default: false},
        color: {type: String, default: ''},
        clientPrice: {type: Boolean, default: false}
    }],
});

module.exports = mongoose.model('budget-item', BudgetItemSchema);