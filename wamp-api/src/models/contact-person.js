const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../lib/mongoHistoryPlugin');

const PersonsSchema = new Schema({
    name: {type: String, required: true},
    profession: [{
        type: String,
        _id: false
    }],
    contact: [{
        type: {type: String, required: true},
        data: {type: String, default: ''},
        _id: false
    }],
    company: [{type: Schema.Types.ObjectId, ref: 'contact-company'}],
    note: {type: String, default: ''},
    deleted: {type: Date, default: null},
    archived: {type: Date, default: null}
}, {timestamps : {createdAt: 'created', updatedAt: 'updated'}});


PersonsSchema.virtual('_user').set(function(v) {
    this.__user = v
});

PersonsSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('contact-person', PersonsSchema);