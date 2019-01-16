const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../lib/mongoHistoryPlugin');

const CompanySchema = new Schema({
    name: {type: String, required: true},
    business: [{
        type: String,
        _id: false
    }],
    contact: [{
        type: {type: String, default: null},
        data: {type: String, default: ''},
        _id: false
    }],
    person: [{type: Schema.Types.ObjectId, ref: 'contact-person'}],
    note: {type: String, default: ''},
    deleted: {type: Date, default: null},
    archived: {type: Date, default: null}
}, {timestamps : {createdAt: 'created', updatedAt: 'updated'}});


CompanySchema.virtual('_user').set(function(v) {
    this.__user = v
});

CompanySchema.plugin(HistoryPlugin());

module.exports = mongoose.model('contact-company', CompanySchema);