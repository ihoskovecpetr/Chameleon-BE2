'use strict';
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: String,
    ssoId: String,
    pinHash: {type: String, default: null},
    pinGroupId : {type: Schema.Types.ObjectId, ref: 'user', default: null },
    access: [{type: String}],
    role: [{type: String}],
    allowedResources: [{type: Schema.Types.ObjectId, ref: 'booking-resource', default: null}],
    resource: {type: Schema.Types.ObjectId, ref: 'booking-resource', default: null},
    email: {type:String, default: null},
    tlf: {type:String, default: null}
});

module.exports = mongoose.model('user', UserSchema);
