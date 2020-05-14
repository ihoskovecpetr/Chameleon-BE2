'use strict';
const mongoose = require('mongoose');
const HistoryPlugin = require('../mongoHistoryPlugin');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: String,
    ssoId: String,
    pinHash: {type: String, default: null},
    pinGroupId : {type: Schema.Types.ObjectId, ref: 'user', default: null },
    access: [{type: String}],
    role: [{type: String}],
    resource: {type: Schema.Types.ObjectId, ref: 'booking-resource', default: null},
    email: {type:String, default: null},
    tlf: {type:String, default: null},
    __v: { type: Number, select: false}
});

UserSchema.virtual('_user').set(function(v) {this.__user = v});
UserSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('user', UserSchema);
